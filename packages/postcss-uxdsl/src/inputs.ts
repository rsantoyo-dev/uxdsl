import { SurfaceTheme, SURFACE_PROPERTIES } from './surfaces';
import { createControlEngine, ControlRole } from './control-engine';
import { BASE_THEME } from './base-theme';

export const INPUT_PROPERTIES: Record<string, string> = { ...SURFACE_PROPERTIES, opacity: 'opacity', outline: 'outline', 'outline-offset': 'outline-offset', transform: 'transform', cursor: 'cursor', 'font-weight': 'font-weight', caret: 'caret-color', placeholder: 'placeholder', underline: 'border-bottom' };
export const INPUT_STATES: Record<string, string[]> = { hover: [':hover'], focus: [':focus'], focusvisible: [':focus-visible'], readonly: [':read-only'], invalid: [':invalid', '[aria-invalid="true"]'], disabled: [':disabled', '[aria-disabled="true"]'] };
export interface InputRole extends ControlRole {}
export interface InputTheme extends SurfaceTheme { inputs?: Record<string, InputRole> }
// MIG-B6-29 (FEAT-008): derived from theme/base.json, not a second,
// independently-maintained literal. Already deep-frozen (base-theme.ts).
export const DEFAULT_INPUTS: Record<string, InputRole> = BASE_THEME.inputs as Record<string, InputRole>;

const engine = createControlEngine({ family: 'input', defaults: DEFAULT_INPUTS, properties: INPUT_PROPERTIES, states: INPUT_STATES, nativeDefaults: { 'box-sizing': 'border-box', font: 'inherit', width: '100%' } });
export const getInputTokens = engine.getTokens;
export const compileInputRules = engine.compileRules;
export const generateInputCss = engine.generateCss;
export const inputDeclarations = engine.declarations;
export const parseInputArguments = engine.parseArguments;
export const inspectInputTheme = engine.inspectTheme;
export const inputComponentCss = engine.componentCss;
