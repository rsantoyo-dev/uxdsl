'use client';

import { useState } from 'react';
import { Sparkles, Brush, Loader2 } from 'lucide-react';

export function AIPrompt() {
  const [prompt, setPrompt] = useState('');
  const [currentThemeName, setCurrentThemeName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyTheme = (themeData: any) => {
    const root = document.documentElement;

    // Apply Palette Colors
    if (themeData.palette) {
      for (const colorType in themeData.palette) {
        const colorVariants = themeData.palette[colorType];
        for (const variant in colorVariants) {
          const cssVarName = `--ds__palette__${colorType}-${variant}`;
          root.style.setProperty(cssVarName, colorVariants[variant]);
        }
      }
    }

    // Apply Spacing
    if (themeData.spacing) {
      for (const spaceKey in themeData.spacing) {
        const cssVarName = `--space-${spaceKey}`;
        root.style.setProperty(cssVarName, themeData.spacing[spaceKey]);
      }
    }

    // Apply Typography
    if (themeData.typography) {
      for (const typoKey in themeData.typography) {
        const cssVarName = `--${typoKey}`; // e.g., --font-code
        root.style.setProperty(cssVarName, themeData.typography[typoKey]);
      }
    }

    // Load Google Fonts dynamically
    if (themeData.fonts?.google && Array.isArray(themeData.fonts.google)) {
      const existingLink = document.getElementById('uxdsl-google-fonts');
      if (existingLink) {
        existingLink.remove();
      }

      const fontFamilies = themeData.fonts.google.map((font: string) => font.replace(/ /g, '+')).join('&family=');
      if (fontFamilies) {
        const link = document.createElement('link');
        link.id = 'uxdsl-google-fonts';
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`;
        document.head.appendChild(link);
      }
    }

    // Apply Font Families
    if (themeData.fonts?.families) {
      for (const fontKey in themeData.fonts.families) {
        const cssVarName = `--font-${fontKey}`; // e.g., --font-ui
        root.style.setProperty(cssVarName, themeData.fonts.families[fontKey]);
      }
    }

    // Log breakpoints and modes but do not apply them directly to CSS variables
    if (themeData.breakpoints) {
      console.log("Breakpoints received:", themeData.breakpoints);
    }
    if (themeData.modes) {
      console.log("Modes received:", themeData.modes);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setCurrentThemeName(''); // Reset current theme name display
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }
      
      if (data.error) {
        console.error(data.error);
        setCurrentThemeName('Error: ' + data.error);
      } else {
        try {
          const themeData = JSON.parse(data.text);
          console.log("Applying UI theme response:", themeData);
          
          applyTheme(themeData);
          
          // Use the AI-corrected name if available, otherwise fallback to prompt
          const displayThemeName = themeData.name || prompt;
          setCurrentThemeName(displayThemeName);
          
        } catch (parseError) {
          console.error('Failed to parse theme JSON:', parseError);
          setCurrentThemeName('Failed to apply theme');
        }
      }
    } catch (error) {
      console.error('Failed to generate:', error);
      setCurrentThemeName('Error generating theme');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isLoading && (
        <div className="theme-loading-overlay">
          <div className="loading-content">
            <Loader2 className="loading-spinner" size={48} />
            <p className="loading-text">
              Updating theme to... <span className="loading-theme-name">&quot;{prompt}&quot;</span>
            </p>
          </div>
        </div>
      )}

      <div className="ai-prompt-container">
        <form onSubmit={handleSubmit} className="ai-prompt-form">
          <div className="input-wrapper">
            <Sparkles className="ai-icon" size={20} />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Name your theme..."
              maxLength={100}
              className="ai-input"
              disabled={isLoading}
            />
            <button type="submit" className="ai-submit-btn" disabled={isLoading || !prompt.trim()}>
              <Brush size={18} />
            </button>
          </div>
        </form>
        
        {currentThemeName && !isLoading && (
          <div className="ai-response">
             <p>Active Theme: <strong>{currentThemeName}</strong></p>
          </div>
        )}
      </div>
    </>
  );
}
