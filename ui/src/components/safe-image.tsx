"use client";

import React, { useState, useMemo } from 'react';

interface SafeImageProps {
    src: string;
    alt: string;
    className?: string;
}

function hashColor(seed: string, offset: number): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = ((hash + offset * 60) % 360 + 360) % 360;
    return `hsl(${h}, 55%, ${30 + offset * 10}%)`;
}

function generatePlaceholder(alt: string): string {
    const c1 = hashColor(alt, 0);
    const c2 = hashColor(alt, 1);
    
    // Find the first actual alphabetical letter, defaulting to 'Z'
    const cleanWordMatch = alt.match(/[a-zA-Z]/);
    const initial = cleanWordMatch ? cleanWordMatch[0].toUpperCase() : "Z";
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1c1917" />
      <stop offset="50%" stop-color="#0c0a09" />
      <stop offset="100%" stop-color="#1c1917" />
    </linearGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="55" />
    </filter>
  </defs>
  <!-- Dark Stone Background -->
  <rect width="800" height="450" fill="url(#bg)" />
  
  <!-- Premium Ambient Blurred Orbs -->
  <circle cx="240" cy="160" r="160" fill="${c1}" opacity="0.38" filter="url(#blur)" />
  <circle cx="560" cy="290" r="200" fill="${c2}" opacity="0.32" filter="url(#blur)" />
  
  <!-- Inner Glassmorphic Badge -->
  <circle cx="400" cy="225" r="68" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />
  
  <!-- Initial Letter (Georgia Serif Italic) -->
  <text x="400" y="225" font-family="'Times New Roman', Georgia, serif" font-size="76" font-style="italic" font-weight="bold" fill="rgba(255,255,255,0.9)" text-anchor="middle" dominant-baseline="central">${initial}</text>
  
  <!-- Micro watermark -->
  <text x="400" y="335" font-family="'Inter', sans-serif" font-size="10" font-weight="700" fill="rgba(255,255,255,0.22)" letter-spacing="5" text-anchor="middle">ZYPHRA MATRIX</text>
</svg>`;
    
    return "data:image/svg+xml," + encodeURIComponent(svg);
}

export default function SafeImage({ src, alt, className = "" }: SafeImageProps) {
    const fallbackSrc = useMemo(() => generatePlaceholder(alt), [alt]);
    const [imgSrc, setImgSrc] = useState(src || fallbackSrc);

    return (
        <img
            src={imgSrc}
            alt={alt}
            className={className}
            onError={() => {
                if (imgSrc !== fallbackSrc) setImgSrc(fallbackSrc);
            }}
        />
    );
}
