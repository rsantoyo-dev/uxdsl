// Canonical Typography values migrated verbatim from the legacy default pack.
// Keep responsive expressions and references intact; the artifact generator uses this map.
export const DEFAULT_TYPOGRAPHY = Object.freeze(Object.fromEntries(
  Object.entries({
  "default": {
    "textTransform": "none",
    "textDecoration": "none",
    "fontStyle": "normal",
    "marginBlockStart": "auto",
    "marginBlockEnd": "auto"
  },
  "h1": {
    "fontSize": "xs(space(7)) md(space(8)) lg(space(9)) xl(space(10))",
    "fontWeight": "700",
    "lineHeight": "xs(1.1) md(1.1)",
    "letterSpacing": "-0.02em",
    "fontFamily": "var(--uxdsl__font__ui)",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "h2": {
    "fontSize": "xs(space(6)) sm(space(7)) lg(space(8)) xl(space(9))",
    "fontWeight": "700",
    "lineHeight": "xs(1.2) md(1.15)",
    "letterSpacing": "-0.01em",
    "fontFamily": "var(--uxdsl__font__ui)",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "h3": {
    "fontSize": "xs(space(6)) md(space(7)) xl(space(8))",
    "fontWeight": "600",
    "lineHeight": "xs(1.3) md(1.25)",
    "letterSpacing": "normal",
    "fontFamily": "var(--uxdsl__font__ui)",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "h4": {
    "fontSize": "xs(space(5)) md(space(6)) xl(space(7))",
    "fontWeight": "600",
    "lineHeight": "1.4",
    "letterSpacing": "normal",
    "fontFamily": "var(--uxdsl__font__ui)",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "h5": {
    "fontSize": "xs(space(5)) xl(space(6))",
    "fontWeight": "600",
    "lineHeight": "1.4",
    "letterSpacing": "normal",
    "fontFamily": "var(--uxdsl__font__ui-2, var(--uxdsl__font__ui))",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "h6": {
    "fontSize": "xs(space(5))",
    "fontWeight": "600",
    "lineHeight": "1.4",
    "letterSpacing": "normal",
    "fontFamily": "var(--uxdsl__font__ui-2, var(--uxdsl__font__ui))",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "p": {
    "fontSize": "xs(space(5))",
    "fontWeight": "400",
    "lineHeight": "1.6",
    "letterSpacing": "normal",
    "fontFamily": "var(--uxdsl__font__ui)",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "span": {
    "fontSize": "xs(space(5))",
    "fontWeight": "400",
    "lineHeight": "1.5",
    "letterSpacing": "normal",
    "fontFamily": "var(--uxdsl__font__ui)",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "body": {
    "fontSize": "xs(space(5))",
    "fontWeight": "400",
    "lineHeight": "1.6",
    "letterSpacing": "normal",
    "fontFamily": "var(--uxdsl__font__ui)",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "caption": {
    "fontSize": "xs(space(4))",
    "lineHeight": "1.4",
    "letterSpacing": "0.01em",
    "fontFamily": "var(--uxdsl__font__ui-2, var(--uxdsl__font__ui))",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "small": {
    "fontSize": "xs(space(4))",
    "lineHeight": "1.4",
    "letterSpacing": "0.01em",
    "fontFamily": "var(--uxdsl__font__ui-2, var(--uxdsl__font__ui))",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  },
  "pre": {
    "fontSize": "xs(space(4))",
    "lineHeight": "1.5",
    "fontFamily": "var(--uxdsl__font__code)",
    "textTransform": "var(--uxdsl__typography__default-transform, none)",
    "textDecoration": "var(--uxdsl__typography__default-decoration, none)",
    "fontStyle": "var(--uxdsl__typography__default-style, normal)",
    "marginBlockStart": "var(--uxdsl__typography__default-margin-block-start, auto)",
    "marginBlockEnd": "var(--uxdsl__typography__default-margin-block-end, auto)"
  }
}).map(([role, fields]) => [role, Object.freeze(fields)])
));

