
UPD
===

**Upgrade NPM Package Dependencies**

[![github (author stars)](https://img.shields.io/github/stars/rse?logo=github&label=author%20stars&color=%233377aa)](https://github.com/rse)
[![github (author followers)](https://img.shields.io/github/followers/rse?label=author%20followers&logo=github&color=%234477aa)](https://github.com/rse)
<br/>
[![npm (project release)](https://img.shields.io/npm/v/upd?logo=npm&label=npm%20release&color=%23cc3333)](https://npmjs.com/upd)
[![npm (project downloads)](https://img.shields.io/npm/dm/upd?logo=npm&label=npm%20downloads&color=%23cc3333)](https://npmjs.com/upd)

Abstract
--------

This is a small Command-Line Interface (CLI) for upgrading the
JavaScript package dependencies in an Node Package Manager (NPM)
`package.json` configuration file while strictly preserving the
formatting of the existing JSON syntax and intentionally skipping
version constraint formulas.

Example
-------

![UPD usage](screenshot.png)

Installation
------------

```
$ npm install -g upd
```

Usage
-----

```
$ upd [-h] [-V] [-q] [-n] [-C] [-f <file>] [-g] [-a] [-c <concurrency>] [<pattern> ...]
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
- `-f <file>`, `--file <file>`<br/>
  Package configuration to use ("package.json").
- `-g`, `--greatest`<br/>
  Use greatest version (instead of latest stable one).
- `-a`, `--all`<br/>
  Show all packages (instead of just updated ones).
- `-c <concurrency>`, `--concurrency <concurrency>`<br/>
  Number of concurrent network connections to NPM registry.
- `<pattern>`<br/>
  Positive or negative (if prefixed with `!`) Glob pattern for matching
  names of dependencies to update.

License
-------

Copyright &copy; 2015-2024 Dr. Ralf S. Engelschall (http://engelschall.com/)

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

