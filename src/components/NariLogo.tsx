import React from 'react';

interface NariLogoProps {
  size?: number;
  className?: string;
  withGlow?: boolean;
  withWordmark?: boolean;
  wordmarkClassName?: string;
  subtitle?: string;
}

/**
 * Zuxrash Brand Mark:
 * Premium abstract "Z" monogram with layered light paths on an obsidian glass plate.
 * The component name is kept stable for backwards compatibility with existing imports.
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
  const gradMain = `zuxrash-main-${id}`;
  const gradHighlight = `zuxrash-highlight-${id}`;
  const gradPlate = `zuxrash-plate-${id}`;
  const gradStroke = `zuxrash-stroke-${id}`;
  const glowInner = `zuxrash-glow-${id}`;

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
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
          role="img"
          aria-label="Zuxrash logo"
        >
          <defs>
            <linearGradient id={gradMain} x1="14" y1="14" x2="50" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="52%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>

            <linearGradient id={gradHighlight} x1="48" y1="14" x2="18" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#f5d0fe" />
              <stop offset="48%" stopColor="#f9a8d4" />
              <stop offset="100%" stopColor="#fb7185" />
            </linearGradient>

            <linearGradient id={gradPlate} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#171026" stopOpacity="0.96" />
              <stop offset="100%" stopColor="#080511" stopOpacity="0.99" />
            </linearGradient>

            <linearGradient id={gradStroke} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
              <stop offset="52%" stopColor="#ec4899" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#fb7185" stopOpacity="0.18" />
            </linearGradient>

            <radialGradient id={glowInner} cx="50%" cy="42%" r="56%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </radialGradient>
          </defs>

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

          <circle cx="32" cy="30" r="20" fill={`url(#${glowInner})`} />

          {/* Main Z ribbon */}
          <path
            d="M17 17.5H46.5C48.8 17.5 50 20.4 48.3 22.1L21.4 43.5C20 44.7 20.8 46.5 22.7 46.5H47"
            stroke={`url(#${gradMain})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Inner light path */}
          <path
            d="M17.5 17.5H44.5L20 46.5"
            stroke={`url(#${gradHighlight})`}
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.92"
          />

          {/* Precision accent */}
          <path
            d="M24 34.5L32 28"
            stroke="#ffffff"
            strokeWidth="1.7"
            strokeLinecap="round"
            opacity="0.82"
          />
          <circle cx="32" cy="28" r="2.1" fill="#ffffff" opacity="0.95" />
          <circle cx="32" cy="28" r="4.6" fill="#f472b6" opacity="0.22" />
        </svg>
      </div>

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
