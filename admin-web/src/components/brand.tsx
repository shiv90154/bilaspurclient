export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-[9px] bg-primary"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.53} height={size * 0.53} viewBox="0 0 24 24" fill="none">
        <path d="M12 3L2 8l10 5 8-4.2V16h2V8L12 3z" fill="#fff" />
        <path d="M6 12.5V17c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5l-6 3-6-3z" fill="#fff" />
      </svg>
    </span>
  );
}

export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="font-display text-[17px] font-bold">EduManage</span>
    </span>
  );
}
