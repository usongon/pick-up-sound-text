export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="拾言"
    >
      <rect width="48" height="48" rx="14" fill="url(#shiyane-grad)" />
      <rect x="11" y="19" width="4" height="10" rx="2" fill="#fff" opacity="0.85" />
      <rect x="18" y="12" width="4" height="24" rx="2" fill="#fff" />
      <rect x="25" y="16" width="4" height="16" rx="2" fill="#fff" opacity="0.92" />
      <rect x="32" y="21" width="4" height="6" rx="2" fill="#fff" opacity="0.75" />
      <defs>
        <linearGradient
          id="shiyane-grad"
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>
    </svg>
  );
}
