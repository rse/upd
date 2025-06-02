#!/usr/bin/env node
/*!
**  UPD -- Upgrade NPM Package Dependencies
**  Copyright (c) 2015-2024 Dr. Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*  internal requirements  */
const fs                = require("fs")

/*  external requirements  */
const yargs             = require("yargs")
const chalk             = require("chalk")
const stripAnsi         = require("strip-ansi")
const diff              = require("fast-diff")
const Table             = require("cli-table3")
const escRE             = require("escape-string-regexp")
const micromatch        = require("micromatch")
const UN                = require("update-notifier")
const semver            = require("semver")
const JsonAsty          = require("json-asty")
const pacote            = require("pacote")
const awaityMapLimit    = require("awaity/mapLimit").default
const Progress          = require("progress")
const prettyBytes       = require("pretty-bytes")
const ducky             = require("ducky")

;(async () => {
    /*  load my own information  */
    const my = require("./package.json")

    /*  automatic update notification (with 2 days check interval)  */
    const notifier = UN({ pkg: my, updateCheckInterval: 1000 * 60 * 60 * 24 * 2 })
    notifier.notify()

    /*  command-line option parsing  */
    const argv = yargs()
        /* eslint indent: off */
        .usage("Usage: $0 [-h] [-V] [-q] [-n] [-C] [-m <name>] [-f <file>] [-g] [-a] [-c <concurrency>] [<pattern> ...]")
        .help("h").alias("h", "help").default("h", false)
            .describe("h", "show usage help")
        .boolean("V").alias("V", "version").default("V", false)
            .describe("V", "show program version information")
        .boolean("q").alias("q", "quiet").default("q", false)
            .describe("q", "quiet operation (do not output upgrade information)")
        .boolean("n").alias("n", "nop").default("n", false)
            .describe("n", "no operation (do not modify package configuration file)")
        .boolean("C").alias("C", "noColor").default("C", false)
            .describe("C", "do not use any colors in output")
        .string("f").nargs("f", 1).alias("f", "file").default("f", "-")
            .describe("f", "package configuration to use (\"package.json\")")
        .boolean("g").alias("g", "greatest").default("g", false)
            .describe("g", "use greatest version (instead of latest stable one)")
        .boolean("a").alias("a", "all").default("a", false)
            .describe("a", "show all packages (instead of just updated ones)")
        .number("c").nargs("c", 1).alias("c", "concurrency").default("c", 8)
            .describe("c", "number of concurrent network connections to NPM registry")
        .version(false)
        .strict()
        .showHelpOnFail(true)
        .demand(0)
        .parse(process.argv.slice(2))

    /*  short-circuit processing of "-V" command-line option  */
    if (argv.version) {
        process.stderr.write(`${my.name} ${my.version} <${my.homepage}>\n`)
        process.stderr.write(`${my.description}\n`)
        process.stderr.write(`Copyright (c) 2015-2024 ${my.author.name} <${my.author.url}>\n`)
        process.stderr.write(`Licensed under ${my.license} <http://spdx.org/licenses/${my.license}.html>\n`)
        process.exit(0)
    }

    /*  determine configuration file  */
    if (argv.file === "-")
        argv.file = "package.json"

    /*  read old configuration file  */
    if (!fs.existsSync(argv.file))
        throw new Error(`cannot find NPM package configuration file under path "${argv.file}"`)
    let pkgTXT = fs.readFileSync(argv.file, { encoding: "utf8" })

    /*  parse configuration file content  */
    const pkgOBJ = JSON.parse(pkgTXT)
    const pkgAST = JsonAsty.parse(pkgTXT)

    /*  honor embedded command line arguments  */
    if (pkgOBJ.upd !== undefined) {
        let args
        if (ducky.validate(pkgOBJ.upd, "[ string* ]"))
            args = pkgOBJ.upd
        else if (ducky.validate(pkgOBJ.upd, "string"))
            args = pkgOBJ.upd.split(/\s+/)
        else
            throw new Error(`invalid field "upd" in configuration file "${argv.file}" ` +
                "(expected string or array of strings)")
        argv._ = args.concat(argv._)
    }

    /*  determine the old NPM module versions (via local package.json)  */
    const manifest = {}
    const mixin = (section) => {
        if (typeof pkgOBJ[section] !== "object")
            return
        Object.keys(pkgOBJ[section]).forEach((module) => {
            const sOld = pkgOBJ[section][module]
            let vOld = sOld
            let state = !(
                   argv._.length === 0
                || micromatch(
                       [ module ],
                       (argv._[0].match(/^!/) !== null ? [ "**" ] : []).concat(argv._)
                   ).length > 0
            ) ? "ignored" : "todo"
            if (state === "todo") {
                const m = sOld.match(/^\s*(?:[\^~]\s*)?(\d+[^<>=|\s]*)\s*$/)
                if (m !== null) {
                    vOld = m[1]
                    state = "check"
                }
                else
                    state = "skipped"
            }
            if (manifest[module] === undefined)
                manifest[module] = []
            manifest[module].push({ section, sOld, vOld, sNew: sOld, vNew: vOld, state })
        })
    }
    mixin("optionalDependencies")
    mixin("peerDependencies")
    mixin("devDependencies")
    mixin("dependencies")

    /*  helper function for retrieving package.json from NPM registry  */
    const fetchPackageInfo = (name) => {
        return new Promise((resolve, reject) => {
            pacote.packument(name, {
                userAgent: `${my.name}/${my.version}`,
                timeout: 20 * 1000
            }).then((data) => {
                resolve(data)
            }).catch((err) => {
                reject(new Error(`package information retrival failed: ${err}`))
            })
        })
    }

    /*  pre-compile the package.json AST query
        (for locating the AST node of a module inside a particular section)  */
    const astQuery = !argv.nop ? pkgAST.compile(`
        .// member [
            ..// member [
                / string [ pos() == 1 && @value == {section} ]
            ]
            &&
            / string [ pos() == 1 && @value == {module} ]
        ]
            / * [ pos() == 2 ]
    `) : null

    /*  determine the new NPM module versions (via remote package.json)  */
    const checked = {}
    Object.keys(manifest).forEach((name) => {
        manifest[name].forEach((spec) => {
            if (spec.state === "check")
                checked[name] = true
        })
    })
    const progressMax = Object.keys(checked).length
    let progressLine = `checking: ${chalk.blue(":bar")} :percent :elapseds :bytes: ${chalk.blue(":msg")} `
    if (argv.noColor)
        progressLine = stripAnsi(progressLine)
    const progressBar = new Progress(progressLine, {
        complete:   "\u{2588}",
        incomplete: "\u{254c}",
        width:      24,
        total:      progressMax,
        stream:     process.stdout,
        clear:      true
    })
    let bytes = 0
    const results = await awaityMapLimit(Object.keys(checked), (name) => {
        let msg = name
        if (msg.length > 24)
            msg = `${msg.substr(0, 19)}...`
        if (msg.length < 24)
            msg = (msg + (Array(24).join(" "))).substr(0, 24)
        return fetchPackageInfo(name.toLowerCase()).then((body) => {
            bytes += JSON.stringify(body).length
            progressBar.tick(1, { bytes: prettyBytes(bytes).replace(/ /g, ""), msg })
            if (progressBar.complete)
                process.stderr.write("\r")
            return { name, data: body }
        }, (error) => {
            progressBar.tick(1, { bytes: prettyBytes(bytes).replace(/ /g, ""), msg })
            if (progressBar.complete)
                process.stderr.write("\r")
            return { name, error }
        })
    }, argv.concurrency)
    let updates = 0
    let errors  = 0
    for (let i = 0; i < results.length; i++) {
        const { name, data, error } = results[i]
        if (error && !data) {
            manifest[name].forEach((spec) => {
                if (spec.state === "check")
                    spec.state = "error"
            })
            errors++
            continue
        }
        let vNew
        if (argv.greatest) {
            const versions = Object.keys(data.versions).sort((a, b) => {
                return semver.rcompare(a, b)
            })
            vNew = versions[0]
        }
        else {
            vNew = data["dist-tags"].latest
            if (vNew === undefined)
                throw new Error(`no "latest" version found for module "${name}"`)
        }
        manifest[name].forEach((spec) => {
            if (spec.state === "check") {
                spec.vNew = vNew
                spec.sNew = vNew
                if (spec.vOld === spec.vNew)
                    spec.state = "kept"
                else if (semver.gt(spec.vOld, spec.vNew))
                    spec.state = "kept"
                else {
                    spec.state = "updated"
                    updates++

                    /*  update manifest  */
                    const re = new RegExp(escRE(spec.vOld), "")
                    spec.sNew = spec.sOld.replace(re, spec.vNew)
                    if (spec.sNew === spec.sOld)
                        throw new Error(`failed to update module "${name}" version string "${spec.sOld}" ` +
                            `from "${spec.vOld}" to "${spec.vNew}" in manifest`)

                    /*  update package.json  */
                    if (!argv.nop) {
                        const nodes = pkgAST.execute(astQuery, {
                            section: spec.section,
                            module:  name
                        })
                        if (nodes.length === 0)
                            throw new Error(`failed to find module "${name}" in section "${spec.section}" ` +
                                "of \"package.json\" AST: no such entry found")
                        if (nodes.length > 1)
                            throw new Error(`failed to locate module "${name}" in section "${spec.section}" ` +
                                "of \"package.json\" AST: multiple entries found")
                        const node = nodes[0]
                        node.set({ body: JSON.stringify(spec.sNew), value: spec.sNew })
                    }
                }
            }
        })
    }

    /*  utility function: mark a piece of text against another one  */
    const mark = function (color, text, other) {
        const result = diff(text, other)
        let output = ""
        result.forEach(function (chunk) {
            if (chunk[0] === diff.INSERT)
                output += chalk[color](chunk[1])
            else if (chunk[0] === diff.EQUAL)
                output += chunk[1]
        })
        return output
    }

    /*  prepare for a nice-looking table output of the dependency upgrades  */
    let table = new Table({
        head: [
            chalk.reset.bold("MODULE NAME"),
            chalk.reset.bold("VERSION ") + chalk.red.bold("OLD"),
            chalk.reset.bold("VERSION ") + chalk.green.bold("NEW"),
            chalk.reset.bold("STATE")
        ],
        colWidths: [ 37, 14, 14, 9 ],
        style: { "padding-left": 1, "padding-right": 1, border: [ "grey" ], compact: true },
        chars: { "left-mid": "", mid: "", "mid-mid": "", "right-mid": "" }
    })

    /*  iterate over all the dependencies  */
    Object.keys(manifest).forEach((name) => {
        manifest[name].forEach((spec) => {
            /*  short-circuit processing  */
            if (!(spec.state === "updated" || spec.state === "error" || argv.all))
                return

            /*  determine module name column  */
            const module = spec.state === "updated" ?
                chalk.reset(name) :
                chalk.grey(name)

            /*  determine older/newer columns  */
            const older = spec.state === "updated" ?
                mark("red", spec.sNew, spec.sOld) :
                chalk.grey(spec.sOld)
            const newer = spec.state === "updated" ?
                mark("green", spec.sOld, spec.sNew) :
                chalk.grey(spec.sNew)

            /*  determine state column  */
            let state
            if (spec.state === "updated")
                state = chalk.green(spec.state)
            else if (spec.state === "error")
                state = chalk.red(spec.state)
            else
                state = chalk.grey(spec.state)

            /*  print the module name, new and old version  */
            table.push([ module, older, newer, state ])
        })
    })
    if (!argv.quiet && (updates || errors || argv.all)) {
        let output = table.toString()
        if (argv.noColor)
            output = stripAnsi(output)
        process.stdout.write(output + "\n")
    }

    /*  display total results  */
    if (!argv.quiet && !(updates || errors || argv.all)) {
        table = new Table({
            head: [],
            colWidths: [ 77 ],
            colAligns: [ "center" ],
            style: { "padding-left": 1, "padding-right": 1, border: [ "grey" ], compact: true },
            chars: { "left-mid": "", mid: "", "mid-mid": "", "right-mid": "" }
        })
        table.push([ chalk.green("ALL PACKAGE DEPENDENCIES UP-TO-DATE") ])
        let output = table.toString()
        if (argv.noColor)
            output = stripAnsi(output)
        process.stdout.write(output + "\n")
    }

    /*  write new configuration file  */
    if (updates && !argv.nop) {
        pkgTXT = JsonAsty.unparse(pkgAST)
        fs.writeFileSync(argv.file, pkgTXT, { encoding: "utf8" })
    }
})().catch((err) => {
    /*  fatal error  */
    process.stderr.write(chalk.red("ERROR:") + " " + err.stack + "\n")
    process.exit(1)
})

