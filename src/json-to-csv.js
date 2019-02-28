const fs = require("fs");
const _ = require("lodash");

/**
 * @param {string} input
 * @returns {string}
 * @private
 */
const _csvEscape = (input) => {
    if (!input) {
        input = '';
    }
    return `"${(input + '')
        .replace(/\t/g, '    ')
        .replace(/\r?\n/g, '\r')
        .replace(/\r[ ]+/g, '\r')
        .replace(/[ ]+\r/g, '\r')
        .replace(/\r\r+/g, '\r\n')
        .replace(/,/g, '&#44;')
        .replace(/"/g, '&#34;')}"`
};

/**
 * @param {string} input
 * @returns {string}
 * @private
 */
const _bodyHtmlEscape = (input) => {
    if (!input) {
        input = '';
    }
    return `"${(input + '')
        .replace(/\t/gm, '    ')
        .replace(/,/gm, '&#44;')
        .replace(/"/gm, '&#34;')
        .replace(/\r?\n/g, '\r')
        .replace(/\r([ ]+)/g, '\r')
        .replace(/([ ]+)\r/g, '\r')
        .replace(/\r+/gm, '\r')
        .replace(/\r/gm, '___')
        .replace(/___/gm, '\r\n')
        .replace(/\r\n([ ]+)/g, '\r\n')
        .replace(/([ ]+)\r\n/g, '\r\n')}"`

};

/**
 * simple csv convert
 * @param {String} input
 * @param {String} output
 */
const convertJsonToCSV = (input, output) => {
    const rawText = fs.readFile(input, (error, data) => {
        if (error) {
            console.error(error);
            return;
        }
        const rawJsonArray = JSON.parse(data);
        let rows = [];
        let isFirst = true;
        _.each(rawJsonArray, (rawJsonRow) => {
            // Do titles (ONLY for first item)
            let columns = [];
            if(isFirst) {
                _.each(rawJsonRow, (value, key) => {
                    if (key === 'bodyHtml') {
                        return;
                    }
                    columns.push(_csvEscape(key));
                });
                const columnCSV = columns.join(',');
                rows.push(columnCSV);
                columns = [];
                isFirst = false;
            }
            // Do Data Row
            _.each(rawJsonRow, (value, key) => {
                if (key === 'assets') {
                    value = value ? value.join('\n') : '';
                }
                if (key === 'bodyHtml') {
                    let matches = rawJsonRow.url.match(/^https?:\/\/[^\/]+\/(.*)\/([^\/]*)$/);
                    let path = `html/${(matches && matches[1]) || ''}`;
                    let file = (matches && matches[2] !== '' ) ?
                        `${((matches && matches[2]) || rawJsonRow.url.replace(/[\/.:?=]/g, '_'))}.html` :
                        'index.html';
                    fs.mkdirSync(path , {recursive: true});
                    fs.writeFileSync(`${path}/${file}`, value)
                } else {
                    columns.push(_csvEscape(value));
                }
            });
            const columnCSV = columns.join(',');
            rows.push(columnCSV);
        });
        const rawCSV = rows.join('\r\n');
        fs.writeFileSync(output, rawCSV);
    });


};

convertJsonToCSV('sorted-results.json', 'sorted-results.csv');