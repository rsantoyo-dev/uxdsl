/**
 * MIG-08: a single contract for building the CSS custom property names
 * every token family emits (`--space-1`, `--density-1`,
 * `--ds__palette__primary-main`, `--ds__color__gray-300`,
 * `--radius-1`/`--border-1`, `--shadow-1`, `--surface-flat-padding`,
 * `--button-contained-hover-bg`, `--input-outlined-focus-border`,
 * `--h1-size`, ...).
 *
 * This module does not rename anything: every helper here reproduces the
 * exact string each family already emitted before centralizing, so wiring
 * it in is a pure refactor. What it adds is `NameRegistry`, which the
 * previous per-family construction had no equivalent of: a way to detect
 * two different logical identifiers (e.g. palette family `"primary-main"`
 * and palette family `"primary"` sub-key `"main"`, or surface role
 * `"contained-shadow"` and role `"contained"` field `"shadow"`) producing
 * the identical generated name, so the second silently overwrites the
 * first with no diagnostic. See docs/features/FEAT-002-beta-migration-hardening.md.
 *
 * Renaming existing public variables is out of scope here: there is no
 * external consumer evidence yet (the package is unpublished) to justify
 * it, and the acceptance criteria this satisfies explicitly allow keeping
 * current public forms while centralizing their construction.
 */

/** `--<family>-<key>` — edges, shadows, surfaces, buttons, inputs,
 * density, spacing and typography all use this one shape. */
export function buildVarName(family: string, key: string): string {
  return `--${family}-${key}`;
}

/** `--ds__<namespace>__<key>` — palette and color are namespaced instead
 * of hyphen-joined so a family name containing a hyphen (`"primary-main"`
 * as a literal top-level palette key, vs. the structured `primary.main`)
 * cannot be confused with the reserved `__` separator itself. It can
 * still collide with another logical identifier that normalizes to the
 * same key — see `NameRegistry`. */
export function buildNamespacedVarName(namespace: string, key: string): string {
  return `--ds__${namespace}__${key}`;
}

/**
 * Tracks which logical identifier (an opaque, human-readable label such
 * as `"surface.contained.shadow"` or `"palette.primary-main"`) first
 * claimed each generated CSS variable name within one compilation pass.
 * A second, different identifier claiming the same name is a naming
 * collision: something will silently apply the wrong value, since only
 * one declaration for that custom property can win. Reusing the *same*
 * identifier (the same family/key claiming its own name again, e.g. once
 * per responsive breakpoint) is expected and not a collision.
 */
export class NameRegistry {
  private readonly claims = new Map<string, string>();
  constructor(private readonly errorPrefix: string) {}

  /** Claim `name` for `identifier`; throws if another identifier already
   * holds it. Returns `name` so this composes inline at the call site. */
  claim(name: string, identifier: string): string {
    const existing = this.claims.get(name);
    if (existing !== undefined && existing !== identifier) {
      throw new Error(`${this.errorPrefix}_NAME_COLLISION: "${identifier}" and "${existing}" both produce ${name}. Rename one of the two.`);
    }
    this.claims.set(name, identifier);
    return name;
  }
}
