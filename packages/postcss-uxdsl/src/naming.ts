/**
 * MIG-08: a single contract for building the CSS custom property names
 * every token family emits (`--uxdsl__space__1`, `--uxdsl__density__1`,
 * `--uxdsl__palette__primary-main`, `--uxdsl__color__gray-300`,
 * `--uxdsl__radius__1`/`--uxdsl__border__1`, `--uxdsl__shadow__1`,
 * `--uxdsl__surface__flat-padding`, `--uxdsl__button__contained-hover-bg`,
 * `--uxdsl__input__outlined-focus-border`, `--uxdsl__typography__h1-size`,
 * ...).
 *
 * Centralizing this construction is what let every family move from a bare
 * `--<family>-<key>` (or, for palette/color, `--ds__<namespace>__<key>`) to
 * one shared `--uxdsl__<family>__<key>` shape in a single place (this file)
 * instead of a blind find-and-replace across every family that used to
 * hardcode its own — requested directly by the maintainer, and done while
 * the package is still unpublished (0.3.0, no npm release), the safest
 * possible time for a public-name change: no external consumer to alias,
 * deprecate or break.
 *
 * `NameRegistry` is the other thing centralizing enabled: a way to detect
 * two different logical identifiers (e.g. palette family `"primary-main"`
 * and palette family `"primary"` sub-key `"main"`, or surface role
 * `"contained-shadow"` and role `"contained"` field `"shadow"`) producing
 * the identical generated name, so the second silently overwrites the
 * first with no diagnostic. See docs/features/FEAT-002-beta-migration-hardening.md.
 */

/** `--uxdsl__<family>__<key>` — edges, shadows, surfaces, buttons, inputs,
 * density, spacing, typography and font families all use this one shape.
 * Every UXDSL-generated custom property carries the `uxdsl__` namespace
 * (not just palette/color) so it is unambiguous — in a browser's computed-
 * style/devtools view, in generated CSS, and in diagnostics — that the
 * variable came from this compiler, at the cost of a few extra
 * characters. */
export function buildVarName(family: string, key: string): string {
  return `--uxdsl__${family}__${key}`;
}

/** `--uxdsl__<namespace>__<key>` — palette and color use the same shape
 * as `buildVarName`, just spelled out for readability at call sites where
 * "namespace" fits better than "family" (both parameters mean the same
 * thing to `NameRegistry`). Namespacing instead of hyphen-joining also
 * means a name containing a hyphen (`"primary-main"` as a literal
 * top-level palette key, vs. the structured `primary.main`) cannot be
 * confused with the reserved `__` separator itself — though it can still
 * collide with another logical identifier that normalizes to the same
 * key; see `NameRegistry`. */
export function buildNamespacedVarName(namespace: string, key: string): string {
  return buildVarName(namespace, key);
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
