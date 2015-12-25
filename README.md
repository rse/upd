
UPD
===

**Upgrade Package Dependencies**

<p/>
<img src="https://nodei.co/npm/upd.png?downloads=true&stars=true" alt=""/>

<p/>
<img src="https://david-dm.org/rse/upd.png" alt=""/>

Abstract
--------

This is a small Command-Line Interface (CLI) around the excellent
[`npm-check-updates`](https://www.npmjs.com/package/npm-check-updates) Node module
for upgrading the package dependencies in an NPM `package.json` or
Bower `bower.json` configuration file while strictly preserving the
formatting of the existing JSON syntax.

Example
-------

Installation
------------

```
$ npm install -g upd
```

Usage
-----

```
$ upd [-h] [-V] [-q] [-n] [-C] [-m <name>] [-f <file>] [-r <url>] [-g] [<pattern> ...]
```

- `-h`, `--help`<br/>
  Show usage help.
- `-V`, `--version`<br/>
  Show program version information.
- `-q`, `--quiet`<br/>
  Quiet operation (do not output upgrade information).
- `-n`, `--nop`<br/>
  No operation (do not modify package configuration file).
- `-C`, `--noColor`<br/>
  Do not use any colors in output.
- `-m <name>`, `--manager <name>`<br/>
  Package manager to use ("npm" or "bower").
- `-f <file>`, `--file <file>`<br/>
  Package configuration to use ("package.json" or "bower.json").
- `-g`, `--greatest`<br/>
  Use greatest version (instead of latest stable one).
- `<pattern>`<br/>
  Positive or negative (if prefixed with `!`) Glob pattern for matching names of dependencies to update.

License
-------

Copyright (c) 2015 Ralf S. Engelschall (http://engelschall.com/)

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

