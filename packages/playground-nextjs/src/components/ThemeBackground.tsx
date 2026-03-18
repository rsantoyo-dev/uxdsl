'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/components/ThemeContext';
import Image from 'next/image';

export const ThemeBackground = memo(function ThemeBackground() {
  const { backgroundImage } = useTheme();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = useMemo(() => {
    if (!backgroundImage) return null
    const encodedPrompt = encodeURIComponent(backgroundImage)
    return `/api/theme-image?prompt=${encodedPrompt}&width=1600&height=900&nologo=true`
  }, [backgroundImage])

  useEffect(() => {
    setImageLoaded(false)
    setImageFailed(false)
  }, [imageUrl])

  if (!imageUrl) return null;

  return (
    <div className="theme-background-container">
      {/* Loading Text - Visible only when image is loading */}
      {!imageLoaded && !imageFailed && (
        <div className="theme-background-loading">
          Creating background art...
        </div>
      )}

      {!imageFailed && (
        <Image
          src={imageUrl}
          alt="Theme Background"
          fill
          priority
          unoptimized
          className="theme-background-image"
          style={{ opacity: imageLoaded ? 0.35 : 0 }}
          onLoadingComplete={() => setImageLoaded(true)}
          onError={() => {
            setImageFailed(true)
            setImageLoaded(true)
          }}
        />
      )}
      <div className="theme-background-tint" />
      <div className="theme-background-overlay" />
    </div>
  );
});