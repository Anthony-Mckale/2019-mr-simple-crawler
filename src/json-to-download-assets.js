const fs = require("fs");
const _ = require("lodash");
const http = require("http");

/**
 * simple csv convert
 * @param {String} input
 * @param {String} output
 */
const downloadAssets = (input, output) => {
    let downloadList = [];
    const rawText = fs.readFile(input, (error, data) => {
        if (error) {
            console.error(error);
            return;
        }
        const rawJsonArray = JSON.parse(data);
        _.each(rawJsonArray, (rawJsonRow) => {
            // Do Data Row
            _.each(rawJsonRow, (value, key) => {
                if (key === 'assets') {
                    downloadList = downloadList.concat(value);
                }
            });
        });
        const download = (downloadFile, callback) => {
            if(!downloadFile) {
                callback();
                return;
            }
            downloadFile = downloadFile.replace(/^https/, 'http');
            let matches = downloadFile.match(/^https?:\/\/[^\/]+\/(.*)\/([^\/]*)$/);
            let path = `assets/${(matches && matches[1]) || ''}`;
            let file = (matches && matches[2] !== '' ) ?
                `${(matches && matches[2]) || (downloadFile.replace(/[\/.:]/g, '_') + '.html')}` :
                'index.html';
            fs.mkdirSync(path , {recursive: true});
            let filepath = `${path}/${file}`;

            const fileHandler = fs.createWriteStream(filepath);
            const request = http.get(downloadFile, function(response) {
                response.pipe(fileHandler);
                fileHandler.on('finish', function() {
                    fileHandler.close(() => {
                        console.log(`  Finished downloading : '${downloadFile}' into '${filepath}'`);
                        callback();
                    });
                });
                fileHandler.on('error', function() {
                    fileHandler.close(() => {
                        console.log(`  Finished downloading (ERROR : '${downloadFile}' into '${filepath}'`);
                        callback();
                    });
                });
            });
        };
        downloadList = downloadList.sort();
        downloadList = _.uniq(downloadList);
        console.log(`Starting: ${downloadList.length} files to download`);
        let i = 0;
        const threads = 5;
        require('async').eachLimit(downloadList, threads,
            (url, next) => {
                i++;
                console.log(`downloading ${i}/${downloadList.length} : ${url}`);
                download(url, next);
            },
            () => {
                console.log('Finished');
            }
        )
    });
};

downloadAssets('sorted-results.json', 'sorted-results.csv');