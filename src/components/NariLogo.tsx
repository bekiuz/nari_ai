import React from 'react';

interface NariLogoProps {
  size?: number; // Size in px (e.g. 16, 24, 32, 40, 48, 64, 80)
  className?: string;
  withGlow?: boolean;
  withWordmark?: boolean;
  wordmarkClassName?: string;
  subtitle?: string;
}

/**
 * Zuxrash Brand Mark:
 * An original, minimalist abstract "N" forged from flowing geometric neural ribbons.
 * Refined neon gradient: soft pink, violet, and subtle crimson on an obsidian base.
 * Fully scalable from 16px to 96px+.
 */
export const NariLogo: React.FC<NariLogoProps> = ({
  size = 32,
  className = '',
  withGlow = false,
  withWordmark = false,
  wordmarkClassName = '',
  subtitle,
}) => {
  const id = React.useId();
  const gradFlow = `nari-flow-${id}`;
  const gradDiag = `nari-diag-${id}`;
  const gradPlate = `nari-plate-${id}`;
  const gradStroke = `nari-stroke-${id}`;
  const glowInner = `nari-glow-${id}`;

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Icon Frame */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Subtle Ambient Radial Glow */}
        {withGlow && (
          <div
            className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-purple-600/25 via-pink-600/20 to-rose-600/15 blur-md pointer-events-none animate-pulse"
            style={{ filter: 'blur(10px)' }}
          />
        )}

        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          <defs>
            {/* Soft Violet -> Vivid Pink -> Crimson flow */}
            <linearGradient id={gradFlow} x1="14" y1="52" x2="52" y2="12" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="52%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>

            {/* Diagonal Ribbon Highlight */}
            <linearGradient id={gradDiag} x1="18" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="50%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>

            {/* Obsidian Glass Plate */}
            <linearGradient id={gradPlate} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#171026" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#080511" stopOpacity="0.98" />
            </linearGradient>

            {/* Hairline Border Stroke */}
            <linearGradient id={gradStroke} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#ec4899" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.15" />
            </linearGradient>

            {/* Subtle Inner Ambient Glow */}
            <radialGradient id={glowInner} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Obsidian Squircle Plate */}
          <rect
            x="2.5"
            y="2.5"
            width="59"
            height="59"
            rx="16"
            fill={`url(#${gradPlate})`}
            stroke={`url(#${gradStroke})`}
            strokeWidth="1.2"
          />

          {/* Ambient Inner Light */}
          <circle cx="32" cy="32" r="20" fill={`url(#${glowInner})`} />

          {/* Minimalist Abstract "N" Geometry */}
          {/* Left Vertical Pillar */}
          <path
            d="M 18 47 V 21 C 18 17.5 20.8 15 24 15 C 27.2 15 29.5 17.5 29.5 21 V 31 L 22.5 45 C 20 48.5 18 47.8 18 47 Z"
            fill={`url(#${gradFlow})`}
          />

          {/* Dynamic Diagonal Neural Light Beam */}
          <path
            d="M 21.5 17.5 L 43.5 46.5 C 45.2 48.5 47.5 47.5 47.5 44.5 V 19 C 47.5 16.5 45.5 14.5 43 14.5 C 40.5 14.5 38.5 16.5 38.5 19 V 26.5 L 26 14.5 C 24 12.8 21.5 14.5 21.5 17.5 Z"
            fill={`url(#${gradDiag})`}
          />

          {/* Right Vertical Pillar with Rising Anchor */}
          <path
            d="M 39 43 V 18 C 39 16 41 14.5 43 14.5 C 45 14.5 46.5 16 46.5 18 V 46 C 46.5 49 44 51 41 51 C 38 51 35 49 35 46 V 37 L 39 43 Z"
            fill={`url(#${gradFlow})`}
          />

          {/* Focal Light Accent */}
          <circle cx="32" cy="31.5" r="2" fill="#ffffff" opacity="0.95" />
          <circle cx="32" cy="31.5" r="4.5" fill="#f472b6" opacity="0.35" />
        </svg>
      </div>

      {/* Wordmark */}
      {withWordmark && (
        <div className={`flex flex-col min-w-0 ${wordmarkClassName}`}>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-semibold tracking-tight text-white text-[15px] sm:text-base">
              Zuxrash
            </span>
            <span className="font-bold tracking-wider bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent text-[14px] sm:text-[15px]">
              AI
            </span>
          </div>
          {subtitle && (
            <span className="text-[11px] text-slate-400 font-normal tracking-normal mt-1 truncate">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
