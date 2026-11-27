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

/** The first of several problems on one line: a theme's errors arrive joined by "; ". */
function oneLine(message: string): string {
  const [first, ...rest] = message.split(/;\s+|\n+/).filter(Boolean);
  if (!first) return 'The theme could not be made.';
  const text = first.length > 160 ? `${first.slice(0, 157)}…` : first;
  return rest.length ? `${text} (and ${rest.length} more)` : text;
}

/**
 * Name a theme and a language model chooses fonts and colors for this site. The route returns
 * them as a theme override already checked for it (src/lib/generated-theme.js): values only, the
 * site's own Spacing, breakpoints and type scale, and colors readable in both modes. It replaces
 * any earlier custom theme and is applied with setCustomTheme → applyTheme, so the hero above it,
 * and every page, changes at once. The theme in use is a small pill, with a way back.
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
      if (!res.ok || !data || data.error) throw new Error(data?.error || `The server answered ${res.status}. Try again.`);
      if (!data.theme || typeof data.theme !== 'object') throw new Error('The server did not return a theme. Try again.');
      // The route already checked this; asking again here is what gives a refusal a message,
      // because a patch the runtime refuses is otherwise dropped without one.
      const checked = checkPatch(baseTheme, data.theme);
      if (!checked.ok) throw new Error(checked.message);
      // The model's name for it when it gives one, the typed name otherwise.
      setCustomTheme(typeof data.name === 'string' && data.name ? data.name : value, data.theme, { replace: true });
      setPrompt('');
    } catch (cause) {
      setError(controller.signal.aborted
        ? 'The model took too long to answer. Try again.'
        : oneLine(cause instanceof Error ? cause.message : ''));
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
        <Sparkles className="ai-prompt__icon" size={20} aria-hidden="true" />
        <input
          type="text"
          value={pending ?? prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Name a theme and watch this page change…"
          maxLength={100}
          className="ai-prompt__input"
          disabled={Boolean(pending)}
          aria-label="Name a theme"
        />
        <button type="submit" className="ai-prompt__submit" disabled={Boolean(pending) || !prompt.trim()} aria-label="Make the theme">
          {pending ? <Loader2 className="ai-prompt__spinner" size={18} aria-hidden="true" /> : <Brush size={18} aria-hidden="true" />}
        </button>
      </form>

      <div className="ai-prompt__row">
        {SUGGESTIONS.map((name) => (
          <button key={name} type="button" className="ai-prompt__suggestion" onClick={() => generate(name)} disabled={Boolean(pending)}>
            {name}
          </button>
        ))}
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
      </div>
      {error && <p className="ai-prompt__error" role="alert">{error}</p>}
    </div>
  );
}
