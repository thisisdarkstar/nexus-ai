import { useId } from 'react';

interface NexusLogoProps {
  size?: number;
  variant?: 'badge' | 'mark';
  className?: string;
  title?: string;
}

/**
 * Custom Nexus AI emblem (Hex Cyber Shield + Neural N Lattice).
 * Uses unique per-instance gradient IDs so multiple sizes render safely on the same page.
 */
export default function NexusLogo({
  size = 24,
  variant = 'badge',
  className,
  title = 'Nexus AI',
}: NexusLogoProps) {
  const uid = useId().replace(/:/g, '');
  const bgId = `nx-bg-${uid}`;
  const shieldStrokeId = `nx-ss-${uid}`;
  const shieldFillId = `nx-sf-${uid}`;
  const coreId = `nx-core-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
    >
      <defs>
        <radialGradient id={bgId} cx="30%" cy="22%" r="85%">
          <stop offset="0%" stopColor="#0f233a" />
          <stop offset="65%" stopColor="#07101f" />
          <stop offset="100%" stopColor="#030712" />
        </radialGradient>
        <linearGradient id={shieldStrokeId} x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id={shieldFillId} x1="32" y1="10" x2="32" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={coreId} x1="21" y1="22" x2="43" y2="43" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>

      {variant === 'badge' && (
        <>
          <rect x="2" y="2" width="60" height="60" rx="15" fill={`url(#${bgId})`} />
          <rect
            x="2.75"
            y="2.75"
            width="58.5"
            height="58.5"
            rx="14.25"
            stroke="#38bdf8"
            strokeOpacity="0.28"
            strokeWidth="1.5"
          />
        </>
      )}

      <path
        d="M32 9.5L51.5 17.5V32C51.5 43.2 43.1 51.6 32 55.2C20.9 51.6 12.5 43.2 12.5 32V17.5L32 9.5Z"
        fill={`url(#${shieldFillId})`}
        stroke={`url(#${shieldStrokeId})`}
        strokeWidth={variant === 'mark' ? 3.8 : 3.2}
        strokeLinejoin="round"
      />

      <path
        d="M23 41.5V22.5L41 41.5V22.5"
        stroke={`url(#${coreId})`}
        strokeWidth={variant === 'mark' ? 5 : 4.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx="23" cy="22.5" r="2.6" fill="#7dd3fc" />
      <circle cx="41" cy="41.5" r="2.6" fill="#34d399" />
      <circle cx="32" cy="14" r="1.8" fill="#10b981" />
    </svg>
  );
}

/**
 * Self-contained inline SVG string for standalone HTML / Print VAPT exports.
 */
export function getNexusReportMarkSvg(size = 18): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;flex-shrink:0"><path d="M32 9.5L51.5 17.5V32C51.5 43.2 43.1 51.6 32 55.2C20.9 51.6 12.5 43.2 12.5 32V17.5L32 9.5Z" fill="#0ea5e9" fill-opacity="0.16" stroke="#10b981" stroke-width="3.8" stroke-linejoin="round"/><path d="M23 41.5V22.5L41 41.5V22.5" stroke="#38bdf8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="23" cy="22.5" r="2.6" fill="#7dd3fc"/><circle cx="41" cy="41.5" r="2.6" fill="#34d399"/></svg>`;
}
