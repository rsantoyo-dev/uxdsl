import { SurfaceTheme, SURFACE_PROPERTIES } from './surfaces';
import { createControlEngine, ControlRole } from './control-engine';

export const BUTTON_PROPERTIES: Record<string, string> = { ...SURFACE_PROPERTIES, opacity: 'opacity', outline: 'outline', 'outline-offset': 'outline-offset', transform: 'transform', cursor: 'cursor', 'font-weight': 'font-weight' };
export const BUTTON_STATES: Record<string, string[]> = { hover: [':hover'], active: [':active'], focus: [':focus'], focusvisible: [':focus-visible'], disabled: [':disabled', '[aria-disabled="true"]'], selected: ['.is-selected', '[aria-pressed="true"]', '[aria-selected="true"]'] };
export interface ButtonRole extends ControlRole {}
export interface ButtonTheme extends SurfaceTheme { buttons?: Record<string, ButtonRole> }
const dark = 'var(--button-tone-dark, var(--ds__palette__primary-dark))';
const main = 'var(--button-tone-main, var(--ds__palette__primary-main))';
const contrast = 'var(--button-tone-contrast, var(--ds__palette__primary-contrast))';
export const DEFAULT_BUTTONS: Record<string, ButtonRole> = {
  contained: { surface: 'contained', base: {}, states: { hover: { bg: dark, color: contrast }, selected: { bg: dark, color: contrast } } },
  outlined: { surface: 'outlined', base: {}, states: { hover: { color: dark, border: `1px solid ${dark}` }, selected: { bg: main, color: contrast, border: `1px solid ${main}` } } },
  flat: { surface: 'flat', base: {}, states: { hover: { color: dark }, selected: { color: dark } } },
};
for (const pack of Object.values(DEFAULT_BUTTONS)) {
  Object.freeze(pack.base);
  for (const state of Object.values(pack.states!)) Object.freeze(state);
  Object.freeze(pack.states); Object.freeze(pack);
}
Object.freeze(DEFAULT_BUTTONS);

const engine = createControlEngine({ family: 'button', defaults: DEFAULT_BUTTONS, properties: BUTTON_PROPERTIES, states: BUTTON_STATES });
export const getButtonTokens = engine.getTokens;
export const compileButtonRules = engine.compileRules;
export const generateButtonCss = engine.generateCss;
export const buttonDeclarations = engine.declarations;
export const parseButtonArguments = engine.parseArguments;
export const inspectButtonTheme = engine.inspectTheme;
export const buttonComponentCss = engine.componentCss;
