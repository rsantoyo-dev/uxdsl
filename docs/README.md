# The `docs/` folder

Two kinds of document live here. Only the first is product documentation.

| Folder | What it is | Maintained as documentation |
| --- | --- | --- |
| [`releases/`](releases/README.md) | What each version shipped, how it was verified and how it was published. | Yes |
| [`architecture/`](architecture/) | Which module owns each part of the engine, and the generated matrix of what the playground demonstrates. | Yes |
| [`ROADMAP.md`](ROADMAP.md) | What the next releases are and when each one is done. | Yes |
| `features/` | The plans and stories the project was built from, story by story. | No: internal history |
| `audits/` | Reviews of the project at a point in time, mostly in Spanish. | No: internal history |

The user documentation is the site, [uxdsl.io](https://uxdsl.io)
(`uxdsl.vercel.app` redirects there), and the package's own pages in
[`packages/uxdsl/docs/`](../packages/uxdsl/docs/). The stability policy is
[`STABILITY.md`](../STABILITY.md) at the repository root.
