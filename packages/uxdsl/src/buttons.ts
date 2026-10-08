import { SurfaceTheme, SURFACE_PROPERTIES } from './surfaces';
import { createControlEngine, ControlRole } from './control-engine';
import { BASE_THEME } from './base-theme';

export const BUTTON_PROPERTIES = { ...SURFACE_PROPERTIES, opacity: 'opacity', outline: 'outline', 'outline-offset': 'outline-offset', transform: 'transform', cursor: 'cursor', 'font-weight': 'font-weight' };
/** A disabled control does not react to the pointer: `hover` and `active`
 * exclude `:disabled`/`[aria-disabled="true"]`. `:where()` keeps the
 * exclusion out of the specificity, so an author's `.btn:hover` written after
 * the directive still overrides the generated rule. */
export const NOT_DISABLED = ':not(:where(:disabled, [aria-disabled="true"]))';
export const BUTTON_STATES = { hover: [`:hover${NOT_DISABLED}`], active: [`:active${NOT_DISABLED}`], focus: [':focus'], focusvisible: [':focus-visible'], disabled: [':disabled', '[aria-disabled="true"]'], selected: ['.is-selected', '[aria-pressed="true"]', '[aria-selected="true"]'] };
export interface ButtonRole extends ControlRole {}
export interface ButtonTheme extends SurfaceTheme { buttons?: Record<string, ButtonRole> }
// Derived from theme/base.json, not a second,
// independently-maintained literal — `var(--uxdsl__button__tone-dark, ...)`
// et al. are baked into the JSON as the same literal strings this file used
// to compute with buildVarName/buildNamespacedVarName. Already deep-frozen
// (base-theme.ts), including every role/base/states level, so the manual
// per-key freeze loop this file used to need is gone too.
export const DEFAULT_BUTTONS: Record<string, ButtonRole> = BASE_THEME.buttons as Record<string, ButtonRole>;

const engine = createControlEngine({ family: 'button', defaults: DEFAULT_BUTTONS, properties: BUTTON_PROPERTIES, states: BUTTON_STATES });
export const getButtonTokens = engine.getTokens;
export const compileButtonRules = engine.compileRules;
export const generateButtonCss = engine.generateCss;
export const buttonDeclarations = engine.declarations;
export const parseButtonArguments = engine.parseArguments;
export const inspectButtonTheme = engine.inspectTheme;
export const buttonComponentCss = engine.componentCss;
