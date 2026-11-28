'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Brush, Loader2, RotateCcw } from 'lucide-react';
import { useTheme } from '@/components/ThemeContext';
import { checkPatch } from '../lib/theme-patch';
import { baseTheme } from '../../themes';

const SUGGESTIONS = ['Ocean', 'Sunset', 'Forest', 'Midnight'];
// The route gives the model less than a minute; past this the request is given up.
const GIVE_UP_MS = 60_000;
// From here on the wait says how long it can be.
const SLOW_AFTER_S = 8;

const NOT_MADE = 'The theme could not be made. Try again, or try another name.';
const TOO_LONG = 'The model took too long to answer. Try again.';

/** The route's own message when it sent one; they are written for a visitor, one line each. */
function routeMessage(data: unknown): string | null {
  const error = data && typeof data === 'object' ? (data as { error?: unknown }).error : null;
  return typeof error === 'string' && error.trim() ? error.trim().slice(0, 160) : null;
}

/**
 * Name a theme and a language model chooses fonts and colors for this site. The route returns
 * them as a theme override already checked for it (src/lib/generated-theme.js): values only, the
 * site's own Spacing, breakpoints and type scale, and colors readable in both modes. It replaces
 * any earlier custom theme and is applied with setCustomTheme → applyTheme, so the hero below it,
 * and every page, changes at once.
 *
 * It is one quiet line: a small field, four names to try, and the theme in use with a way back.
 * What it says when it fails is a sentence of its own; the cause goes to the console.
 */
export function AIPrompt() {
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const { setCustomTheme, customThemeName, currentTheme, switchTheme } = useTheme();

  useEffect(() => {
    if (!pending) return undefined;
    setSeconds(0);
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [pending]);

  const generate = async (name: string) => {
    const value = name.trim();
    if (!value || pending) return;
    setPending(value);
    setError(null);
    const controller = new AbortController();
    const giveUp = setTimeout(() => controller.abort(), GIVE_UP_MS);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: value }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      const theme = data && typeof data === 'object' ? data.theme : null;
      if (!res.ok || !theme || typeof theme !== 'object') {
        console.error(`[Name a theme] the route answered ${res.status}`, data);
        setError(routeMessage(data) || NOT_MADE);
        return;
      }
      // The route already checked this; asking again here is what tells a refusal apart,
      // because a patch the runtime refuses is otherwise dropped without a word.
      const checked = checkPatch(baseTheme, theme);
      if (!checked.ok) {
        console.error('[Name a theme] the theme was refused:', checked.message);
        setError(NOT_MADE);
        return;
      }
      // The model's name for it when it gives one, the typed name otherwise.
      setCustomTheme(typeof data.name === 'string' && data.name ? data.name : value, theme, { replace: true });
      setPrompt('');
    } catch (cause) {
      // A network failure, or an exception while applying: never the exception's own text.
      if (!controller.signal.aborted) console.error('[Name a theme]', cause);
      setError(controller.signal.aborted ? TOO_LONG : NOT_MADE);
    } finally {
      clearTimeout(giveUp);
      setPending(null);
    }
  };

  return (
    <div className="ai-prompt">
      <form
        className="ai-prompt__form"
        onSubmit={(event) => { event.preventDefault(); generate(prompt); }}
      >
        <Sparkles className="ai-prompt__icon" size={14} aria-hidden="true" />
        <input
          type="text"
          value={pending ?? prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Name a theme…"
          maxLength={100}
          className="ai-prompt__input"
          disabled={Boolean(pending)}
          aria-label="Name a theme and this site takes its fonts and colors"
        />
        <button type="submit" className="ai-prompt__submit" disabled={Boolean(pending) || !prompt.trim()} aria-label="Make the theme">
          {pending ? <Loader2 className="ai-prompt__spinner" size={14} aria-hidden="true" /> : <Brush size={14} aria-hidden="true" />}
        </button>
      </form>

      <div className="ai-prompt__row" role="group" aria-label="Themes to try">
        {SUGGESTIONS.map((name) => (
          <button key={name} type="button" className="ai-prompt__suggestion" onClick={() => generate(name)} disabled={Boolean(pending)}>
            {name}
          </button>
        ))}
      </div>

      <span className="ai-prompt__status" role="status">
        {pending
          ? (
            <>
              Painting “{pending}”…
              {/* Outside what a screen reader is told: it would be read every second. */}
              <span aria-hidden="true">{seconds} s{seconds >= SLOW_AFTER_S ? ' · it can take half a minute' : ''}</span>
            </>
          )
          : currentTheme === 'custom' && customThemeName
            ? (
              <>
                Theme: <strong>{customThemeName}</strong>
                <button type="button" className="ai-prompt__reset" onClick={() => switchTheme('default')}>
                  <RotateCcw size={12} aria-hidden="true" /> Back to default
                </button>
              </>
            )
            : null}
      </span>
      {error && <p className="ai-prompt__error" role="alert">{error}</p>}
    </div>
  );
}
