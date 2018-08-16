#!/usr/bin/env node

const crawler = require('npm-license-crawler')
const thenify = require('thenify')
import * as got from 'got'

async function getNpmLicenses(licenseJson: any): Promise<Array<Object>> {
    let result = [];
    for (let p of Object.keys(licenseJson)) {
        let info = licenseJson[p]
        let license = await fetchLicense(p, info.licenses, info.licenseUrl, info.repository)
        // await fs.write(o, `# ${p}\n\n${license}\n\n`)
        result.push({name: p.split('@')[0], license});
    }
    return result;
}

const overrides = new Map<string, string>([
    ['json-schema@0.2.3', 'BSD-3-Clause'],
    ['jsonify@0.0.0', 'Public domain'],
    ['buffers@0.1.1', 'MIT'],
    ['string-to-js@0.0.1', 'MIT'],
    ['indexof@0.0.1', 'MIT'],
    ['rgb@0.1.0', 'MIT'],
])

async function fetchLicense(
    module: string,
    licenseId: string | undefined,
    licenseUrl: string | undefined,
    repositoryUrl: string | undefined
): Promise<string> {
    console.error(`Processing ${module} (${licenseUrl})`)

    if (overrides.has(module)) {
        console.error(`Using override for ${module}`)
        licenseId = overrides.get(module)
        licenseUrl = undefined
        repositoryUrl = undefined

        if (licenseId === 'Public domain') {
            return 'public domain'
        }
    }

    if (licenseUrl) {
        try {
            let response = await got(licenseUrl)
            let contentType = response.headers['content-type']
            if (contentType && contentType.startsWith('text/plain')) {
                console.error('Used licenseUrl')
                return response.body
            }
        } catch (e) {}
    }

    if (repositoryUrl && repositoryUrl.match(/^https:\/\/github.com\/([^\/]+)\/([^\/]+?)(.git){0,1}$/)) {
        // repositoryUrl is the base url for a github repo
        const [, user, repo] = repositoryUrl.match(/^https:\/\/github.com\/([^\/]+)\/([^\/]+)$/) || [, , ,]
        const rawBase = `https://raw.githubusercontent.com/${user}/${repo}/master/`
        for (let filename of ['license', 'LICENSE']) {
            try {
                let license = (await got(rawBase + filename)).body
                console.error(`Used '${filename}'`)
                return license
            } catch (e) {}
        }

        for (let filename of ['README.md', 'readme.markdown', 'README.markdown']) {
            try {
                let readme = (await got(rawBase + filename)).body
                let [, license] = readme.match(/#\s*license\s+(.*)$/) || [, ,]
                if (license) {
                    console.error(`Extracted from ${filename}`)
                    return license
                }
            } catch (e) {}
        }
    }

    try {
        let spdxBase = 'https://raw.githubusercontent.com/spdx/license-list-data/master/text/'
        let license = (await got(spdxBase + licenseId + '.txt')).body
        console.error(`Used spdx reference for ${licenseId}`)
        return license
    } catch (e) {}

    console.error(`Failed to find license for ${module}`)
    return ''
}

function cleanLicenses(licenseJson: any): void {
    const newLicenseJson = JSON.parse(JSON.stringify(licenseJson))

    Object.keys(licenseJson).forEach((key) => {
        if (
            key.includes('@types') ||
            (licenseJson[key].parents === 'UNDEFINED' && licenseJson[key].licenses === 'UNLICENSED')
        ) {
            console.error(`Filtering out ${key}`)
            delete newLicenseJson[key]
        }
    })
    return newLicenseJson
}

export default async function (inputDir: string, onlyDirectDependencies: boolean = true): Promise<void> {
    console.log(onlyDirectDependencies);
    console.error(`Generating licenses for npm packages under ${inputDir}`)
    const dumpLicenses = thenify(crawler.dumpLicenses)

    let licenseJson = await dumpLicenses({
        start: inputDir,
        onlyDirectDependencies: onlyDirectDependencies,
    })

    licenseJson = cleanLicenses(licenseJson)
    console.log(await getNpmLicenses(licenseJson));
}
