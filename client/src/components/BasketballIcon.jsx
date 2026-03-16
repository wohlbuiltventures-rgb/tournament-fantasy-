import { useId } from 'react';

export default function BasketballIcon({ size = 24, className = '' }) {
  const uid = useId();
  const gradId = `bball-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="36%" cy="30%" r="65%" gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#F4943A" />
          <stop offset="55%"  stopColor="#E07820" />
          <stop offset="100%" stopColor="#B85A10" />
        </radialGradient>
      </defs>

      {/* Ball body */}
      <circle cx="16" cy="16" r="15" fill={`url(#${gradId})`} />

      {/* Outer edge — thin dark ring */}
      <circle cx="16" cy="16" r="15" stroke="#1a0900" strokeWidth="0.75" />

      {/* Horizontal seam */}
      <line
        x1="1" y1="16" x2="31" y2="16"
        stroke="#1a0900"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Vertical seam */}
      <line
        x1="16" y1="1" x2="16" y2="31"
        stroke="#1a0900"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Subtle specular highlight */}
      <ellipse
        cx="11" cy="10" rx="4" ry="2.5"
        fill="white" opacity="0.12"
        transform="rotate(-30 11 10)"
      />
    </svg>
  );
}
