import Image from "next/image";

import { cn } from "@/lib/utils";

type Props = {
  /** Rendered height in px. Width is auto-computed from source aspect. */
  size?: number;
  variant?: "colour" | "mono";
  className?: string;
};

// Full Henselite lockup (icon + script wordmark). Colour variant uses the
// official PNG (which includes the "Choice of Champions" tagline); mono
// variant uses the black JPG (no tagline). On dark surfaces the caller
// adds `className="invert"` to flip mono → white.
export function HenseliteWordmark({
  size = 28,
  variant = "colour",
  className,
}: Props) {
  if (variant === "mono") {
    const SRC_W = 1024;
    const SRC_H = 307;
    const width = Math.round((size * SRC_W) / SRC_H);
    return (
      <Image
        src="/brand/henselite/Henselite-Logo-Black-1024x307.jpg"
        alt="Henselite"
        width={SRC_W}
        height={SRC_H}
        priority={false}
        className={cn("block shrink-0 select-none", className)}
        style={{ width, height: size }}
      />
    );
  }

  const SRC_W = 373;
  const SRC_H = 135;
  const width = Math.round((size * SRC_W) / SRC_H);
  return (
    <Image
      src="/brand/henselite/henselite-logo.png"
      alt="Henselite"
      width={SRC_W}
      height={SRC_H}
      priority={false}
      className={cn("block shrink-0 select-none", className)}
      style={{ width, height: size }}
    />
  );
}
