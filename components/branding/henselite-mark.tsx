import Image from "next/image";

import { cn } from "@/lib/utils";

type Props = {
  /** Rendered height in px. Width matches (icon is square). */
  size?: number;
  variant?: "colour" | "mono";
  className?: string;
};

// Icon-only Henselite mark. The brand pack ships only horizontal +
// stacked lockups (no icon-only file), so the icon is cropped from the
// available raster via overflow + offset positioning. Crop coordinates
// derive from visual inspection of each source asset; if the brand
// pack later includes an icon-only file, swap the source and drop the
// crop offsets.
//
// Mono on dark surfaces: caller adds `className="invert"` (no SVG fork).
export function HenseliteMark({
  size = 24,
  variant = "colour",
  className,
}: Props) {
  if (variant === "mono") {
    // Source: 1024x307 horizontal lockup. Icon occupies the leftmost
    // ~270x307 box. Scale by height so 307 source rows map to `size`,
    // then clip width to `size` so only the icon remains visible.
    const scale = size / 307;
    const renderedWidth = 1024 * scale;
    return (
      <span
        aria-hidden={false}
        className={cn(
          "relative inline-block shrink-0 overflow-hidden align-middle",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src="/brand/henselite/Henselite-Logo-Black-1024x307.jpg"
          alt="Henselite"
          width={1024}
          height={307}
          priority={false}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: renderedWidth,
            height: size,
            maxWidth: "none",
          }}
        />
      </span>
    );
  }

  // Colour: stacked 1500x1500 webp. Icon sits in the upper portion,
  // roughly x∈[300,1170] y∈[80,880]. Scale so the icon's ~870px square
  // maps to `size`, then offset to bring the icon into view.
  const scale = size / 870;
  return (
    <span
      className={cn(
        "relative inline-block shrink-0 overflow-hidden align-middle",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/brand/henselite/collection-list-bowls-henselite.webp"
        alt="Henselite"
        width={1500}
        height={1500}
        priority={false}
        style={{
          position: "absolute",
          top: -80 * scale,
          left: -300 * scale,
          width: 1500 * scale,
          height: 1500 * scale,
          maxWidth: "none",
        }}
      />
    </span>
  );
}
