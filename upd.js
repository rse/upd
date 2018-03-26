#!/usr/bin/env node
/*!
**  UPD -- Upgrade Package Dependencies (UPD)
**  Copyright (c) 2015-2018 Ralf S. Engelschall <rse@engelschall.com>
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

/*  external requirements  */
const fs          = require("fs")
const yargs       = require("yargs")
const chalk       = require("chalk")
const stripAnsi   = require("strip-ansi")
const diff        = require("fast-diff")
const Table       = require("cli-table")
const escRE       = require("escape-string-regexp")
const micromatch  = require("micromatch")
const UN          = require("update-notifier")
const packageJson = require("package-json")
const semver      = require("semver")
const JsonAsty    = require("json-asty")

;(async () => {
    /*  load my own information  */
    const my = require("./package.json")

    /*  automatic update notification (with 2 days check interval)  */
    var notifier = UN({ pkg: my, updateCheckInterval: 1000 * 60 * 60 * 24 * 2 })
    notifier.notify()

    /*  command-line option parsing  */
    let argv = yargs
        .usage("Usage: $0 [-h] [-V] [-q] [-n] [-C] [-m <name>] [-f <file>] [-g] [<pattern> ...]")
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
        .strict()
        .showHelpOnFail(true)
        .demand(0)
        .parse(process.argv.slice(2))

    /*  short-circuit processing of "-V" command-line option  */
    if (argv.version) {
        process.stderr.write(my.name + " " + my.version + " <" + my.homepage + ">\n")
        process.stderr.write(my.description + "\n")
        process.stderr.write("Copyright (c) 2015-2018 " + my.author.name + " <" + my.author.url + ">\n")
        process.stderr.write("Licensed under " + my.license + " <http://spdx.org/licenses/" + my.license + ".html>\n")
        process.exit(0)
    }

    /*  determine configuration file  */
    if (argv.file === "-")
        argv.file = "package.json"

    /*  read old configuration file  */
    if (!fs.existsSync(argv.file))
        throw "cannot find NPM package configuration file under path \"" + argv.file + "\""
    let pkgData = fs.readFileSync(argv.file, { encoding: "utf8" })
    let pkgDataOld = pkgData

    /*  parse configuration file content  */
    let pkg = JSON.parse(pkgData)
    let ast = JsonAsty.parse(pkgData)

    /*  determine the old NPM module versions (via local package.json)  */
    let manifest = {}
    const mixin = (section) => {
        if (typeof pkg[section] === "object") {
            Object.keys(pkg[section]).forEach((module) => {
                let sOld = pkg[section][module]
                let vOld = sOld
                let state = !(
                    argv._.length === 0 ||
                    micromatch([ module ], (argv._[0].match(/^!/) !== null ? [ "*" ] : []).concat(argv._)).length > 0
                ) ? "skipped" : "todo"
                if (state === "todo") {
                    let m = sOld.match(/^\s*(?:[\^~]\s*)?(\d+[^<>=|\s]*)\s*$/)
                    if (m !== null) {
                        vOld = m[1]
                        state = "check"
                    }
                    else
                        state = "ignored"
                }
                if (manifest[module] === undefined)
                    manifest[module] = []
                manifest[module].push({ section, sOld, vOld, sNew: sOld, vNew: vOld, state })
            })
        }
    }
    mixin("optionalDependencies")
    mixin("peerDependencies")
    mixin("devDependencies")
    mixin("dependencies")

    /*  determine the new NPM module versions (via remote package.json)  */
    let promises = []
    let checked = {}
    Object.keys(manifest).forEach((name) => {
        manifest[name].forEach((spec) => {
            if (spec.state === "check")
                checked[name] = true
        })
    })
    Object.keys(checked).forEach((name) => {
        promises.push(packageJson(name.toLowerCase(), { allVersions: argv.greatest })
            .then((data) => ({ name, data })))
    })
    let results = await Promise.all(promises)
    let updates = false
    for (let i = 0; i < results.length; i++) {
        let { name, data } = results[i]
        let vNew
        if (argv.greatest) {
            let versions = Object.keys(data.versions).sort((a, b) => {
                return semver.rcompare(a, b)
            })
            vNew = versions[0]
        }
        else
            vNew = data.version
        manifest[name].forEach((spec) => {
            if (spec.state === "check") {
                spec.vNew = vNew
                spec.sNew = vNew
                if (spec.vOld === spec.vNew)
                    spec.state = "kept"
                else {
                    spec.state = "updated"
                    updates = true

                    /*  update manifest  */
                    let re = new RegExp(escRE(spec.vOld), "")
                    spec.sNew = spec.sOld.replace(re, spec.vNew)
                    if (spec.sNew === spec.sOld)
                        throw new Error(`failed to update module "${name}" version string "${spec.sOld}" ` +
                            `from "${spec.vOld}" to "${spec.vNew}" in manifest`)

                    /*  update package.json  */
                    let nodes = ast.query(`
                        .// object-member [
                            ..// object-member [
                                / object-member-name
                                    / value-string [ @value == {section} ]
                            ]
                            &&
                            / object-member-name
                                / value-string [ @value == {module} ]
                        ]
                            / object-member-value
                                / value-string
                    `, {
                        section: spec.section,
                        module:  name
                    })
                    if (nodes.length !== 1)
                        throw new Error(`failed to find module "${name}" in section "${spec.section}" ` +
                            `of "package.json" AST`)
                    let node = nodes[0]
                    node.set({ text: JSON.stringify(spec.sNew), value: spec.sNew })
                }
            }
        })
    }

    /*  utility function: mark a piece of text against another one  */
    const mark = function (color, text, other) {
        var result = diff(text, other)
        var output = ""
        result.forEach(function (chunk) {
            if (chunk[0] === diff.INSERT)
                output += chalk[color](chunk[1])
            else if (chunk[0] === diff.EQUAL)
                output += chunk[1]
        })
        return output
    }

    /*  prepare for a nice-looking table output of the dependency upgrades  */
    table = new Table({
        head: [
            chalk.reset.bold("MODULE NAME"),
            chalk.reset.bold("VERSION ") + chalk.red.bold("OLD"),
            chalk.reset.bold("VERSION ") + chalk.green.bold("NEW")
        ],
        colWidths: [ 42, 16, 16 ],
        style: { "padding-left": 1, "padding-right": 1, border: [ "grey" ], compact: true },
        chars: { "left-mid": "", "mid": "", "mid-mid": "", "right-mid": "" }
    })

    /*  iterate over all the dependencies  */
    Object.keys(manifest).forEach((name) => {
        manifest[name].forEach((spec) => {
            /*  short-circuit processing  */
            if (spec.state !== "updated" && !argv.all)
                return

            /*  determine new and old version  */
            let sOld = spec.sOld
            let sNew = spec.sNew

            /*  print the module name, new and old version  */
            if (spec.state === "updated")
                table.push([ chalk.reset(name), mark("red", spec.sNew, spec.sOld), mark("green", spec.sOld, spec.sNew) ])
            else
                table.push([ chalk.grey(`${name} [${spec.state.toUpperCase()}]`), chalk.grey(spec.sOld), chalk.grey(spec.sNew) ])
        })
    })

    /*  display total results  */
    if (!argv.quiet) {
        if (!updates) {
            table = new Table({
                head: [],
                colWidths: [ 76 ],
                colAligns: [ "middle" ],
                style: { "padding-left": 1, "padding-right": 1, border: [ "grey" ], compact: true },
                chars: { "left-mid": "", "mid": "", "mid-mid": "", "right-mid": "" }
            })
            table.push([ chalk.green("ALL PACKAGE DEPENDENCIES UP-TO-DATE") ])
            output = table.toString()
            process.stdout.write(output + "\n")
        }
        else {
            output = table.toString()
            if (argv.noColor)
                output = stripAnsi(output)
            process.stdout.write(output + "\n")
        }
    }

    /*  write new configuration file  */
    if (updates && !argv.nop) {
        pkgData = JsonAsty.unparse(ast)
        fs.writeFileSync(argv.file, pkgData, { encoding: "utf8" })
    }

})().catch((err) => {
    /*  fatal error  */
    process.stderr.write(chalk.red("ERROR:") + " " + err.stack + "\n")
    process.exit(1)
})

