let Crawler = require("crawler");
let _ = require("lodash");
let fs = require("fs");
let config = require('../config/crawl.json');
let TurndownService = require('turndown');

// simple config
let startingProtocal = config.startingProtocal;
let domain = config.domain;
let startingLocation = config.startingLocation;
let subdomainList = config.subdomainList;
let maxResults = config.maxResults;
let includeBody = config.includeBody;
let includePageLinks = config.includePageLinks;

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
    maxConnections : 20,
    /**
     * This will be called for each crawled page
     * @param error
     * @param res
     * @param done
     */
    callback : (error, res, done) => {
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

            let title = $("head title").text();
            let description = $('meta[name="Description"]').attr('content');
            if (!description) {
                description = $('meta[name="description"]').attr('content');
            }
            description = description ? description : null;


            let bodyText = null;
            if(includeBody) {
                let turndownService = new TurndownService();
                turndownService.remove('script');
                bodyText = $('#main-content').html();
                if (!bodyText) {
                    bodyText = $('#main_content').html();
                } if (!bodyText) {
                    bodyText = $('#blq-content').html();
                }

                bodyText = bodyText ? turndownService.turndown(bodyText) : null;
            }

            // page type

            // pid due to non-breaking zero width spaces inside pids no ending ---> "
            let pid = res.body.match(/"pid":"([a-zA-Z0-9]+)/);
            pid = pid ? pid[1] : null;

            let gameSwfConfig = res.body.match(/var GameConfig = (.*)-->/);
            if (gameSwfConfig) {
                gameSwfConfig = gameSwfConfig[1];
            }

            let imageSrc = null;
            let imageAlt = null;
            let factsheet = $('div.factsheet .image_wrapper img');
            if (factsheet.length) {
                factsheet = $(factsheet[0]).attr('src');
                imageSrc = factsheet;
                imageAlt = $(factsheet[0]).attr('alt');
                // has doc / pdf and notes
            } else {
                factsheet = null;
                imageSrc = null;
                imageAlt = null;
            }

            let worksheetConfig = res.body.match(/var worksheetConfig = (.*)-->/);
            if (worksheetConfig) {
                worksheetConfig = worksheetConfig[1];
            }

            let quizDoc = $('div.quiz #download_doc a');
            let quizPdf = null;
            if (quizDoc.length) {
                quizDoc = $(quizDoc[0]).attr('href');
                quizPdf = $($('div.quiz #download a')[0]).attr('href');
            } else {
                quizDoc = null;
                quizPdf = null;
            }

            let isTutor = res.options.uri.match(/\/tutor\//);
            let isAdultLearners = res.options.uri.match(/\/learners\//);

            let pageType = 'unknown';
            if (pid) {
                pageType = 'video';
            } else if (gameSwfConfig) {
                pageType = 'game';
            } else if (worksheetConfig) {
                pageType = 'worksheet';
            } else if (quizDoc) {
                pageType = 'quiz';
            } else if (isTutor) {
                pageType = 'tutor';
            } else if (isAdultLearners) {
                pageType = 'adult-learners';
            } else if (factsheet) {
                pageType = 'factsheet';
            }

            const statusCode = res.statusCode + '';
            const htmlSize = res.body ?
                Math.round(res.body.length / 1024) + 'kb' :
                null;

            let isTopic = res.options.uri.match(/\/topic\//);
            if (isTopic) {
                pageType = `topic-${pageType}`;
            }

            pageDetails[res.options.uri] = {
                url: res.options.uri,
                title,
                description,
                pageType,
                statusCode,
                htmlSize,
                pid,
                gameSwfConfig,
                worksheetConfig,
                quizDoc,
                quizPdf,
                imageSrc,
                imageAlt,
                bodyText
            };
            try {
                JSON.stringify(pageDetails[res.options.uri], null, '  ');
            } catch (e){
                console.log(e);
            }
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

                // ignore 404 / error pages
                let errorDiv = $('#error-404');
                if (errorDiv.length) {
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
            });
            if (!includePageLinks) {
                pageDetails[res.options.uri].pageLinks = validPageLinks.join('\n');
            }

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