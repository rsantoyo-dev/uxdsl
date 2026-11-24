'use client';

import { useState } from 'react';
import { Sparkles, Brush, Loader2, RotateCcw } from 'lucide-react';
import { useTheme } from '@/components/ThemeContext';

const SUGGESTIONS = ['Ocean', 'Sunset', 'Forest', 'Midnight'];

/**
 * Name a theme and a language model writes a theme override for this site; it is applied with
 * setCustomTheme → applyTheme, so the hero above it, and every page, changes at once. It changes
 * values only: the components are not rebuilt. The theme in use is a small pill, with a way back.
 */
export function AIPrompt() {
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setCustomTheme, customThemeName, currentTheme, switchTheme } = useTheme();

  const generate = async (name: string) => {
    const value = name.trim();
    if (!value || pending) return;
    setPending(value);
    setError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: value }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Server error: ${res.status}`);
      const themeData = JSON.parse(data.text);
      // The model's corrected name when it gives one, the typed name otherwise.
      setCustomTheme(themeData.name || value, themeData);
      setPrompt('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The theme could not be made.');
    } finally {
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
            ? <>Painting “{pending}”…</>
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
