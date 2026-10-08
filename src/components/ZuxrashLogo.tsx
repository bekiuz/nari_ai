import React from 'react';

interface ZuxrashLogoProps {
  size?: number;
  className?: string;
  withGlow?: boolean;
  withWordmark?: boolean;
  wordmarkClassName?: string;
  subtitle?: string;
}

/**
 * Zuxrash premium brand mark.
 * Kept as an SVG so it stays sharp on Android, web, and high-density displays.
 */
export const ZuxrashLogo: React.FC<ZuxrashLogoProps> = ({
  size = 32,
  className = '',
  withGlow = false,
  withWordmark = false,
  wordmarkClassName = '',
  subtitle,
}) => {
  const id = React.useId();
  const main = `zuxrash-main-${id}`;
  const shine = `zuxrash-shine-${id}`;
  const plate = `zuxrash-plate-${id}`;
  const border = `zuxrash-border-${id}`;

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {withGlow && (
          <div
            className="absolute -inset-2 rounded-2xl pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(236,72,153,.28) 0%, rgba(139,92,246,.18) 42%, transparent 72%)',
              filter: 'blur(12px)',
            }}
          />
        )}

        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative w-full h-full"
          role="img"
          aria-label="Zuxrash logo"
        >
          <defs>
            <linearGradient id={plate} x1="8" y1="5" x2="56" y2="59" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1C1230" />
              <stop offset="100%" stopColor="#07050D" />
            </linearGradient>

            <linearGradient id={main} x1="15" y1="14" x2="51" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C4B5FD" />
              <stop offset="48%" stopColor="#F472B6" />
              <stop offset="100%" stopColor="#FB7185" />
            </linearGradient>

            <linearGradient id={shine} x1="18" y1="18" x2="46" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".95" />
              <stop offset="100%" stopColor="#FBCFE8" stopOpacity=".35" />
            </linearGradient>

            <linearGradient id={border} x1="7" y1="4" x2="57" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A855F7" stopOpacity=".7" />
              <stop offset="55%" stopColor="#EC4899" stopOpacity=".45" />
              <stop offset="100%" stopColor="#FB7185" stopOpacity=".2" />
            </linearGradient>
          </defs>

          <rect x="3" y="3" width="58" height="58" rx="17" fill={`url(#${plate})`} />
          <rect x="3" y="3" width="58" height="58" rx="17" stroke={`url(#${border})`} />

          {/* Distinct Z monogram — no central dot or eye shape. */}
          <path
            d="M17 19H47L20 45H47"
            stroke={`url(#${main})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Crisp glass highlights. */}
          <path
            d="M19 19H43"
            stroke={`url(#${shine})`}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M22 45H46"
            stroke="#FBCFE8"
            strokeOpacity=".62"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Small AI spark. */}
          <path
            d="M48 12V20M44 16H52"
            stroke="#FCE7F3"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity=".95"
          />
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
