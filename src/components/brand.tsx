export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="rounded-[9px] object-cover"
      style={{ width: size, height: size }}
    />
  );
}

export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="font-display text-[17px] font-bold">DHĪ</span>
    </span>
  );
}
