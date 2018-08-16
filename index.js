#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const crawler = require('npm-license-crawler');
const thenify = require('thenify');
const fs = require("mz/fs");
const got = require("got");
function writeLicenses(licenseJson, outputDir) {
    return __awaiter(this, void 0, void 0, function* () {
        let result = [];
        for (let p of Object.keys(licenseJson)) {
            let info = licenseJson[p];
            let license = yield fetchLicense(p, info.licenses, info.licenseUrl, info.repository);
            // await fs.write(o, `# ${p}\n\n${license}\n\n`)
            result.push({ name: p.split("@")[0], license });
        }
        fs.writeFile(outputDir, JSON.stringify(result), "utf8", function (err) {
            if (err) {
                return console.log(err);
            }
            console.log("The file is saved!");
        });
    });
}
const overrides = new Map([
    ['json-schema@0.2.3', 'BSD-3-Clause'],
    ['jsonify@0.0.0', 'Public domain'],
    ['buffers@0.1.1', 'MIT'],
    ['string-to-js@0.0.1', 'MIT'],
    ['indexof@0.0.1', 'MIT'],
    ['rgb@0.1.0', 'MIT'],
]);
function fetchLicense(module, licenseId, licenseUrl, repositoryUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        console.error(`Processing ${module} (${licenseUrl})`);
        if (overrides.has(module)) {
            console.error(`Using override for ${module}`);
            licenseId = overrides.get(module);
            licenseUrl = undefined;
            repositoryUrl = undefined;
            if (licenseId === 'Public domain') {
                return 'public domain';
            }
        }
        if (licenseUrl) {
            try {
                let response = yield got(licenseUrl);
                let contentType = response.headers['content-type'];
                if (contentType && contentType.startsWith('text/plain')) {
                    console.error('Used licenseUrl');
                    return response.body;
                }
            }
            catch (e) { }
        }
        if (repositoryUrl && repositoryUrl.match(/^https:\/\/github.com\/([^\/]+)\/([^\/]+?)(.git){0,1}$/)) {
            // repositoryUrl is the base url for a github repo
            const [, user, repo] = repositoryUrl.match(/^https:\/\/github.com\/([^\/]+)\/([^\/]+)$/) || [, , ,];
            const rawBase = `https://raw.githubusercontent.com/${user}/${repo}/master/`;
            for (let filename of ['license', 'LICENSE']) {
                try {
                    let license = (yield got(rawBase + filename)).body;
                    console.error(`Used '${filename}'`);
                    return license;
                }
                catch (e) { }
            }
            for (let filename of ['README.md', 'readme.markdown', 'README.markdown']) {
                try {
                    let readme = (yield got(rawBase + filename)).body;
                    let [, license] = readme.match(/#\s*license\s+(.*)$/) || [, ,];
                    if (license) {
                        console.error(`Extracted from ${filename}`);
                        return license;
                    }
                }
                catch (e) { }
            }
        }
        try {
            let spdxBase = 'https://raw.githubusercontent.com/spdx/license-list-data/master/text/';
            let license = (yield got(spdxBase + licenseId + '.txt')).body;
            console.error(`Used spdx reference for ${licenseId}`);
            return license;
        }
        catch (e) { }
        console.error(`Failed to find license for ${module}`);
        return '';
    });
}
function cleanLicenses(licenseJson) {
    const newLicenseJson = JSON.parse(JSON.stringify(licenseJson));
    Object.keys(licenseJson).forEach((key) => {
        if (key.includes('@types') ||
            (licenseJson[key].parents === 'UNDEFINED' && licenseJson[key].licenses === 'UNLICENSED')) {
            console.error(`Filtering out ${key}`);
            delete newLicenseJson[key];
        }
    });
    return newLicenseJson;
}
function default_1(inputDir, outputDir, onlyDirectDependencies = true) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(onlyDirectDependencies);
        console.error(`Generating licenses for npm packages under ${inputDir}`);
        const dumpLicenses = thenify(crawler.dumpLicenses);
        let licenseJson = yield dumpLicenses({
            start: inputDir,
            onlyDirectDependencies: onlyDirectDependencies,
        });
        licenseJson = cleanLicenses(licenseJson);
        yield writeLicenses(licenseJson, outputDir);
    });
}
exports.default = default_1;
