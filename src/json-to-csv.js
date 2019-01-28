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
    return `"${input.replace(/"/g, '""')}" `
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
                    columns.push(_csvEscape(key));
                });
                const columnCSV = columns.join(',');
                rows.push(columnCSV);
                columns = [];
                isFirst = false;
            }
            // Do Data Row
            _.each(rawJsonRow, (value, key) => {
                columns.push(_csvEscape(value));
            });
            const columnCSV = columns.join(',');
            rows.push(columnCSV);
        });
        const rawCSV = rows.join('\n');
        fs.writeFileSync(output, rawCSV);
    });


};

convertJsonToCSV('unsorted-results.json', 'unsorted-results.csv');
convertJsonToCSV('sorted-results.json', 'sorted-results.csv');