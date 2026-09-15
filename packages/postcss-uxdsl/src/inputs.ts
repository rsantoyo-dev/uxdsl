import { SurfaceTheme, SURFACE_PROPERTIES } from './surfaces';
import { createControlEngine, ControlRole } from './control-engine';
import { buildVarName, buildNamespacedVarName } from './naming';

export const INPUT_PROPERTIES: Record<string, string> = { ...SURFACE_PROPERTIES, opacity: 'opacity', outline: 'outline', 'outline-offset': 'outline-offset', transform: 'transform', cursor: 'cursor', 'font-weight': 'font-weight', caret: 'caret-color', placeholder: 'placeholder', underline: 'border-bottom' };
export const INPUT_STATES: Record<string, string[]> = { hover: [':hover'], focus: [':focus'], focusvisible: [':focus-visible'], readonly: [':read-only'], invalid: [':invalid', '[aria-invalid="true"]'], disabled: [':disabled', '[aria-disabled="true"]'] };
export interface InputRole extends ControlRole {}
export interface InputTheme extends SurfaceTheme { inputs?: Record<string, InputRole> }
const main = `var(${buildVarName('input', 'tone-main')}, var(${buildNamespacedVarName('palette', 'primary-main')}))`;
export const DEFAULT_INPUTS: Record<string, InputRole> = {
  contained: { surface: 'contained', base: { caret: main, placeholder: 'palette(neutral.dark)' }, states: { focus: { border: `1px solid ${main}`, shadow: 'shadow(2)' }, invalid: { border: '1px solid palette(error.main)' }, disabled: { color: 'palette(neutral.dark)', opacity: '0.6' } } },
  outlined: { surface: 'outlined', base: { caret: main, placeholder: 'palette(neutral.dark)' }, states: { focus: { border: `1px solid ${main}` }, invalid: { border: '1px solid palette(error.main)' }, disabled: { opacity: '0.6' } } },
  underline: { surface: 'flat', base: { border: 'none', shadow: 'none', underline: '1px solid palette(neutral.dark)', caret: main, placeholder: 'palette(neutral.dark)' }, states: { focus: { underline: `1px solid ${main}` }, invalid: { underline: '1px solid palette(error.main)' }, disabled: { opacity: '0.6' } } },
};
for (const pack of Object.values(DEFAULT_INPUTS)) {
  Object.freeze(pack.base);
  for (const state of Object.values(pack.states!)) Object.freeze(state);
  Object.freeze(pack.states); Object.freeze(pack);
}
Object.freeze(DEFAULT_INPUTS);

const engine = createControlEngine({ family: 'input', defaults: DEFAULT_INPUTS, properties: INPUT_PROPERTIES, states: INPUT_STATES, nativeDefaults: { 'box-sizing': 'border-box', font: 'inherit', width: '100%' } });
export const getInputTokens = engine.getTokens;
export const compileInputRules = engine.compileRules;
export const generateInputCss = engine.generateCss;
export const inputDeclarations = engine.declarations;
export const parseInputArguments = engine.parseArguments;
export const inspectInputTheme = engine.inspectTheme;
export const inputComponentCss = engine.componentCss;
