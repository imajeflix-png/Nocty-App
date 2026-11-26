import React, { useState } from 'react';

const FALLBACK_GLYPHS: Record<string, string> = {
  '2764-fe0f': '❤️',
  '2728': '✨',
  '1f609': '😉',
  '1f319': '🌙',
  '1f525': '🔥',
  '1f97a': '🥺',
  '1f3a7': '🎧',
  '1f495': '💕',
  '1f3b5': '🎵',
  '1f4ac': '💬',
};

export function unifiedToFallbackGlyph(unified: string): string {
  const key = unified.toLowerCase();
  if (FALLBACK_GLYPHS[key]) return FALLBACK_GLYPHS[key];
  try {
    const codePoints = key
      .split('-')
      .map((hex) => Number.parseInt(hex, 16))
      .filter((cp) => Number.isFinite(cp) && cp > 0);
    return codePoints.length > 0 ? String.fromCodePoint(...codePoints) : '✨';
  } catch {
    return '✨';
  }
}

export function getAppleEmojiCdnUrl(unified: string): string {
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/${unified.toLowerCase()}.png`;
}

export interface AppleEmojiProps {
  unified: string;
  size?: number;
  alt?: string;
  className?: string;
}

export const AppleEmoji: React.FC<AppleEmojiProps> = ({
  unified,
  size = 18,
  alt,
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);
  const fallback = unifiedToFallbackGlyph(unified);

  if (hasError) {
    return (
      <span
        role="img"
        aria-label={alt || fallback}
        className={`inline-flex items-center justify-center shrink-0 select-none leading-none ${className}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.9) }}
      >
        {fallback}
      </span>
    );
  }

  return (
    <img
      src={getAppleEmojiCdnUrl(unified)}
      alt={alt || fallback}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => setHasError(true)}
      className={`inline-block shrink-0 align-middle select-none object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
