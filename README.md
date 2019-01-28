# 2019-mr-simple-crawler
simple 20-30 throw away crawler

## Install

npm install

## Run

node src/index.js

## Convert JSON to CSV results

node src/json-to-csv.js

## To Configure

edit config/crawl.json

- "startingProtocal" : "https://",
- "domain": "www.bbc.co.uk" will limit all crawling to this domain
- "startingLocation": "/skillswise/0/" first page to crawl
- "subdomainList": list of valid subdomains (must be at least one!)
- "maxResults": max results, null === unlimited
