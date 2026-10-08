#!/usr/bin/env node
'use strict';

// Deprecated: uxdsl-cli is part of the `uxdsl` package now. This runs the
// `uxdsl` command that package ships, unchanged; it prints nothing of its own.
const path = require('path');

require(path.join(path.dirname(require.resolve('uxdsl/package.json')), 'bin', 'uxdsl.js')).main();
