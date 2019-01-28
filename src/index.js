let Crawler = require("crawler");
let _ = require("lodash");
let fs = require("fs");
let config = require('../config/crawl.json');

let startingProtocal = config.startingProtocal;
let domain = config.domain;
let startingLocation = config.startingLocation;
let subdomainList = config.subdomainList;
let maxResults = config.maxResults;

let pageDetails = {};

let matchesSubDomains = (url) => {
    let matching = false;
    _.each(subdomainList, (subdomain => {
        // quick fork on matching
        if (matching) {
            return false;
        }
        const regex = `^((https?:)?\/?\/${domain.replace(/\//, '\\/')})?${subdomain.replace(/\//, '\\/')}`;
        matching = !!url.match(new RegExp(regex));
        // console.log(regex, url, matching);
    }));
    return matching;
};

let totalPagesDiscovered = 0;
let totalPagesParsed = 0;
let totalPagesErrored = 0;
let pagesKey = {};

const addPage = (url) => {
    if(pagesKey[url]) {
        return;
    }
    pagesKey[url] = true;
    if(maxResults && totalPagesDiscovered > maxResults) {
        // console.log(`  SUCCESS BUT FAIL: not queuing new url: ${url} as reached discovery cap`);
        return;
    }
    totalPagesDiscovered++;
    // console.log(`  SUCCESS: queuing new url: ${url}`);
    c.queue(url);
};

const notAddingPage = (url) => {
    if(pagesKey[url]) {
        return;
    }
    // console.log(`  FAIL: not queuing invalid url: ${url}`);
    pagesKey[url] = true;
};

const onPageError = (url) => {
    totalPagesErrored++;
    console.log(`ERROR: ${url} (P:${totalPagesParsed} / E:${totalPagesErrored} / D: ${totalPagesDiscovered})`);
    pagesKey[url] = true;
};

const onPageParsed = (url) => {
    totalPagesParsed++;
    console.log(`SUCCESS: ${url} (P:${totalPagesParsed} / E:${totalPagesErrored} / D: ${totalPagesDiscovered})`);
    pagesKey[url] = true;
};

let c = new Crawler({
    maxConnections : 1,
    /**
     * This will be called for each crawled page
     * @param error
     * @param res
     * @param done
     */
    callback : function (error, res, done) {
        if (error) {
            onPageError(res.options.uri);
        } else {
            let $ = res.$;

            // console.log(res.body);
            // $ is Cheerio by default
            //a lean implementation of core jQuery designed specifically for the server
            // console.log({
            //     title: $("head title").text(),
            //     description: $('meta[name="Description"]').attr('content'),
            //     bodyText: $('#main-content').text()
            // });

            let pid = res.body.match(/"pid":"([a-zA-Z0-9]+)"/);
            pid = pid ? pid[1] : null;

            let description = $('meta[name="Description"]').attr('content');
            if (!description) {
                description = $('meta[name="description"]').attr('content');
            }
            description = description ? description : null;

            let bodyText = $('#main-content').text();
            if (!bodyText) {
                bodyText = $('#main_content').text();
            }
            bodyText = bodyText ? bodyText : null;

            pageDetails[res.options.uri] = {
                url: res.options.uri,
                title: $("head title").text(),
                description: description,
                pid: pid,
                bodyText: $('#main-content').text()
            };
            let validPageLinks = [];
            _.each($('a'), (aTag) => {
                let location = $(aTag).attr('href');
                if (!location || !location.match) {
                   // console.log('ERROR: weird a tag skipped', $().append(aTag).html());
                   return;
                }
                let isComplexRelative = location.match(/^\/\//);
                if (isComplexRelative) {
                    // console.log(`  isComplexRelative => ${location}`);
                    location = location.replace(/^\/\//, 'https://');
                    // console.log(`    now => ${location}`);
                }
                let isSimpleRelative = location.match(/^\/[a-zA-Z0-9]+/);
                if (isSimpleRelative) {
                    // console.log(`  isSimpleRelative => ${location}`);
                    location = location.replace(/^\//, `https://${domain}/`);
                    // console.log(`    now => ${location}`);
                }

                // ignore xml docs
                let isXmlDoc = location.match(/\.xml$/);
                if (isXmlDoc) {
                    notAddingPage(location);
                    return;
                }

                let isValid = matchesSubDomains(location);
                if (isValid) {
                    addPage(location);
                    validPageLinks.push(`${$(aTag).text()} => ${location}`);
                } else {
                    notAddingPage(location);
                }
                pageDetails[res.options.uri].pageLinks = validPageLinks.join('\n');
            });
            onPageParsed(res.options.uri);
        }
        done();
    }
});

c.on('drain',function(){
    fs.writeFileSync('raw-results.json', pageDetails);
    let sortedPageDetails = _(pageDetails).toPairs().sortBy(0).fromPairs().value();
    let jsonStringResults = JSON.stringify(sortedPageDetails, null, '  ');
    fs.writeFileSync('sorted-results.json', jsonStringResults);
});

// Queue just one URL, with default callback
addPage(`${startingProtocal}${domain}${startingLocation}`);