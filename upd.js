#!/usr/bin/env node
/*!
**  UPD -- Upgrade Package Dependencies (UPD)
**  Copyright (c) 2015-2016 Ralf S. Engelschall <rse@engelschall.com>
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
var fs         = require("fs")
var yargs      = require("yargs")
var co         = require("co")
var ncu        = require("npm-check-updates")
var chalk      = require("chalk")
var diff       = require("fast-diff")
var Table      = require("cli-table")
var escRE      = require("escape-string-regexp")
var micromatch = require("micromatch")
var UN         = require("update-notifier")

co(function * () {
    /*  load my own information  */
    var my = require("./package.json")

    /*  automatic update notification (with 2 days check interval)  */
    var notifier = UN({ pkg: my, updateCheckInterval: 1000 * 60 * 60 * 24 * 2 })
    notifier.notify()

    /*  command-line option parsing  */
    var argv = yargs
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
        .string("m").nargs("m", 1).alias("m", "manager").default("m", "-")
            .describe("m", "package manager to use (\"npm\" or \"bower\")")
        .string("f").nargs("f", 1).alias("f", "file").default("f", "-")
            .describe("f", "package configuration to use (\"package.json\" or \"bower.json\")")
        .boolean("g").alias("g", "greatest").default("g", false)
            .describe("g", "use greatest version (instead of latest stable one)")
        .strict()
        .showHelpOnFail(true)
        .demand(0)
        .parse(process.argv.slice(2))

    /*  short-circuit processing of "-V" command-line option  */
    if (argv.version) {
        process.stderr.write(my.name + " " + my.version + " <" + my.homepage + ">\n")
        process.stderr.write(my.description + "\n")
        process.stderr.write("Copyright (c) 2015 " + my.author.name + " <" + my.author.url + ">\n")
        process.stderr.write("Licensed under " + my.license + " <http://spdx.org/licenses/" + my.license + ".html>\n")
        process.exit(0)
    }

    /*  determine configuration file and/or package manager  */
    if (argv.manager === "-" && argv.file === "-") {
        argv.manager = "npm"
        argv.file = "package.json"
    }
    else if (argv.file === "-")
        argv.file = (argv.manager === "npm" ? "package.json" : "bower.json")
    else if (argv.manager === "-")
        argv.manager = (argv.file.match(/bower/) ? "bower" : "npm")

    /*  read old configuration file  */
    if (!fs.existsSync(argv.file))
        throw "cannot find NPM package configuration file under path \"" + argv.file + "\""
    var pkgData = fs.readFileSync(argv.file, { encoding: "utf8" })
    var pkgDataOld = pkgData

    /*  determine package manager version  */
    var vManager = "0.0.0"
    if (argv.manager === "npm")
        vManager = require("npm/package.json").version
    else if (argv.manager === "bower")
        vManager = require("bower/package.json").version
    else
        throw "invalid package manager \"" + argv.manager + "\""

    /*  provide package manager and package configuration information  */
    var table = new Table({
        head: [
            chalk.reset.bold("PACKAGE MANAGER"),
            chalk.reset.bold("PACKAGE CONFIGURATION")
        ],
        colWidths: [ 20, 55 ],
        style: { "padding-left": 1, "padding-right": 1, border: [ "grey" ], compact: true },
        chars: { "left-mid": "", "mid": "", "mid-mid": "", "right-mid": "" },
        border: [ "red" ]
    })
    table.push([ argv.manager + " " + vManager, argv.file ])
    var output = table.toString()
    if (argv.noColor)
        output = chalk.stripColor(output)
    if (!argv.quiet)
        process.stdout.write(output + "\n")

    /*  let "npm-check-updates" do the heavy lifting of
        determining the latest NPM module versions  */
    var json = yield (ncu.run({
        json:           true,
        jsonUpgraded:   true,
        loglevel:       "silent",
        packageData:    pkgData,
        packageManager: argv.manager,
        greatest:       argv.greatest,
        args:           []
    }))

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

    /*  parse configuration file content  */
    var pkg = JSON.parse(pkgData)

    /*  iterate over the upgraded dependencies  */
    var mods = Object.keys(json)
    mods.forEach(function (mod) {
        /*  determine new and old version  */
        var vNew = json[mod]
        var vOld
        var sections = [ "dependencies", "devDependencies", "peerDependencies", "optionalDependencies" ]
        for (var i = 0; i < sections.length; i++) {
            if (typeof pkg[sections[i]] === "object" && typeof pkg[sections[i]][mod] === "string") {
               vOld = pkg[sections[i]][mod]
               break
            }
        }
        if (vOld === undefined)
            throw "old version for module \"" + mod + "\" not found"

        /*  determine whether module should be updated  */
        var update = (
            argv._.length === 0 ||
            micromatch([ mod ], (argv._[0].match(/^!/) !== null ? [ "*" ] : []).concat(argv._)).length > 0
        )

        /*  utility function: mark a piece of text against another one  */
        var mark = function (color, text, other) {
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

        /*  print the module name, new and old version  */
        if (update)
            table.push([ chalk.reset(mod), mark("red", vNew, vOld), mark("green", vOld, vNew) ])
        else
            table.push([ chalk.grey(mod + " [SKIPPED]"), chalk.grey(vOld), chalk.grey(vNew) ])

        /*  update the configuration file content  */
        if (update) {
            var re = new RegExp("(\"" + escRE(mod) + "\"[ \t\r\n]*:[ \t\r\n]*\")" + escRE(vOld) + "(\")", "g")
            var pkgDataNew = pkgData.replace(re, "$1" + vNew + "$2")
            if (pkgDataNew === pkgData)
                throw "failed to update module \"" + mod + "\" from version \"" + vOld + "\" to \"" + vNew + "\""
            pkgData = pkgDataNew
        }
    })

    /*  display results  */
    if (!argv.quiet) {
        if (mods.length === 0) {
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
                output = chalk.stripColor(output)
            process.stdout.write(output + "\n")
        }
    }

    /*  write new configuration file  */
    if (mods.length > 0 && !argv.nop && pkgDataOld !== pkgData)
        fs.writeFileSync(argv.file, pkgData, { encoding: "utf8" })

}).catch(function (err) {
    /*  fatal error  */
    process.stderr.write(chalk.red("ERROR:") + " " + err + "\n")
    process.exit(1)
})

