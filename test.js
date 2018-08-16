#!/usr/bin/env node

const crawler = require('.');
console.log('+++');
crawler.default('../../mvp', 'b.json').then((data) => {console.log('test'); console.log(data)});
console.log('---');
// console.log(crawler.run());
// console.log(crawler());
// crawler('../../mvp');