# The move to one package, `uxdsl`

Stability phase 4 (decision DE-1) merged the five packages into
`packages/uxdsl` and prepared a deprecated re-export of each former name under
`packages/_deprecated/`. The first release of `uxdsl` is `0.5.0-beta.9` (no
`0.5.0-beta.7` was published; `0.5.0-beta.8` was the last release of the five
former packages, [its record](0.5.0-beta.8.md)); its publish steps — `uxdsl`
itself, the deprecation of the five former names and the optional shims — are
in [0.5.0-beta.9.md](0.5.0-beta.9.md).
