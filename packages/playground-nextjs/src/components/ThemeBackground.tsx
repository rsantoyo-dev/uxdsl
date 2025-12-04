'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeContext';
import Image from 'next/image';

export const ThemeBackground = () => {
  const { backgroundImage } = useTheme();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (backgroundImage) {
      setImageLoaded(false); // Reset loaded state when image changes
      // Encode the description for the URL
      const encodedPrompt = encodeURIComponent(backgroundImage);
      // Use Pollinations.ai for better relevance
      const finalUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1600&height=900&nologo=true`;
      setImageUrl(finalUrl);
    } else {
      setImageUrl(null);
      setImageLoaded(false);
    }
  }, [backgroundImage]);

  if (!imageUrl) return null;

  return (
    <div className="theme-background-container">
      {/* Loading Text - Visible only when image is loading */}
      {!imageLoaded && (
        <div className="theme-background-loading">
          Creating background art...
        </div>
      )}

      <Image
        src={imageUrl}
        alt="Theme Background"
        fill
        priority
        className="theme-background-image"
        style={{ opacity: imageLoaded ? 0.7 : 0 }} // Fade in to 0.7 opacity
        onLoadingComplete={() => setImageLoaded(true)}
      />
      <div className="theme-background-tint" />
      <div className="theme-background-overlay" />
    </div>
  );
};