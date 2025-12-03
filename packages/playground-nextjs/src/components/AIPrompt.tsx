'use client';

import { useState } from 'react';
import { Sparkles, Brush, Loader2 } from 'lucide-react';
import { useTheme } from '@/components/ThemeContext';

export function AIPrompt() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setCustomTheme, customThemeName, currentTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    
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
        alert('Error: ' + data.error); // Simple alert for error for now
      } else {
        try {
          const themeData = JSON.parse(data.text);
          console.log("Applying UI theme response:", themeData);
          
          // Use the AI-corrected name if available, otherwise fallback to prompt
          const displayThemeName = themeData.name || prompt;
          
          // Delegate theme application to the centralized context
          setCustomTheme(displayThemeName, themeData);
          
        } catch (parseError) {
          console.error('Failed to parse theme JSON:', parseError);
          alert('Received response, but failed to apply theme.');
        }
      }
    } catch (error) {
      console.error('Failed to generate:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to generate response: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setPrompt(''); // Clear the prompt after submission
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
        
        {currentTheme === 'custom' && customThemeName && !isLoading && (
          <div className="ai-response">
             <p>Active Theme: <strong>{customThemeName}</strong></p>
          </div>
        )}
      </div>
    </>
  );
}
