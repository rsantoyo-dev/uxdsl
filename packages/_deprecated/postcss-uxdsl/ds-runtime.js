'use strict';

// Deprecated: postcss-uxdsl is part of the `uxdsl` package now. This module only
// re-exports uxdsl/engine and uxdsl/runtime (the two entries the former ds-runtime barrel
// was split into, with uxdsl/theme inside uxdsl/engine); it prints nothing and adds nothing.
module.exports = { ...require('uxdsl/engine'), ...require('uxdsl/runtime') };
