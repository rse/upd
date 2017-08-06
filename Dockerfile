##
##  UPD -- Upgrade Package Dependencies (UPD)
##  Copyright (c) 2004-2017 Ralf S. Engelschall <rse@engelschall.com>
##
##  Permission is hereby granted, free of charge, to any person obtaining
##  a copy of this software and associated documentation files (the
##  "Software"), to deal in the Software without restriction, including
##  without limitation the rights to use, copy, modify, merge, publish,
##  distribute, sublicense, and/or sell copies of the Software, and to
##  permit persons to whom the Software is furnished to do so, subject to
##  the following conditions:
##
##  The above copyright notice and this permission notice shall be included
##  in all copies or substantial portions of the Software.
##
##  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
##  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
##  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
##  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
##  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
##  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
##  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
##

ARG        NODE_VERSION=8-alpine

FROM       node:${NODE_VERSION}

ENV        NPM_CONFIG_LOGLEVEL=error

ARG        UPD_VERSION=latest
ENV        UPD_VERSION=${UPD_VERSION}

LABEL      maintainer="Ralf S. Engelschall <rse@engelschall.com>" \
           usage="docker run --rm -i -t -v \$PWD:/pwd -e TERM engelschall/upd [<options>]"

WORKDIR    /app

COPY       . .

RUN        npm install; \
           npm cache clear --force; \
           rm -f package-lock.json; \
           find node_modules -name "test"       -type d -print | xargs rm -rf; \
           find node_modules -name "tests"      -type d -print | xargs rm -rf; \
           find node_modules -name "example"    -type d -print | xargs rm -rf; \
           find node_modules -name "examples"   -type d -print | xargs rm -rf; \
           find node_modules -name "README"     -type f -print | xargs rm -f; \
           find node_modules -name "README.md"  -type f -print | xargs rm -f; \
           find node_modules -name "LICENSE"    -type f -print | xargs rm -f; \
           find node_modules -name "LICENSE.md" -type f -print | xargs rm -f

WORKDIR    /pwd

VOLUME     [ "/pwd" ]

USER       node:node

ENTRYPOINT [ "node", "--", "/app/upd.js" ]

