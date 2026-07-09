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
    return `hsl(${h}, 50%, ${35 + offset * 8}%)`;
}

function generatePlaceholder(alt: string): string {
    const c1 = hashColor(alt, 0);
    const c2 = hashColor(alt, 1);
    const initial = alt ? alt.charAt(0).toUpperCase() : "?";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/><text x="400" y="225" font-family="Georgia,serif" font-size="120" font-weight="bold" fill="rgba(255,255,255,0.2)" text-anchor="middle" dominant-baseline="central">${initial}</text></svg>`;
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
