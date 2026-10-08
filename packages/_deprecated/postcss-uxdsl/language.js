'use strict';

// Deprecated: postcss-uxdsl is part of the `uxdsl` package now. This module only
// re-exports uxdsl/language and uxdsl/engine (where the rest of the former language
// module's helpers went); it prints nothing and adds nothing.
module.exports = { ...require('uxdsl/engine'), ...require('uxdsl/language') };
