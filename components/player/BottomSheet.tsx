"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

// Phase 8 player surface — bottom sheet wrapper around `vaul`.
// Dedicated player primitive (rather than reusing components/ui/drawer
// directly) for two reasons:
//
//   1. The design source uses a specific bone-coloured surface +
//      `rounded-2xl` top + the speckle-friendly background — the
//      generic ui/drawer is shadcn defaults (popover bg + thin handle).
//   2. Player surfaces use it for the confirm-end / book-slot / sync-
//      detail flows, all of which benefit from a stable component
//      contract instead of repeating the className prop chain.
//
// Slots: BottomSheet (Root), BottomSheet.Trigger (optional, can drive
// open from a child), BottomSheet.Content. Title/Description optional;
// pass-through when needed for screen readers — the design does not
// always render a heading inside the sheet body.

type RootProps = React.ComponentProps<typeof DrawerPrimitive.Root>;

function Root(props: RootProps) {
  // `shouldScaleBackground={false}` keeps the page chrome static —
  // the design renders the sheet over a flat dim, not the iOS card-
  // shrink effect. Override per-instance if a specific surface wants it.
  return (
    <DrawerPrimitive.Root
      data-slot="bottom-sheet"
      shouldScaleBackground={false}
      {...props}
    />
  );
}

const Trigger = DrawerPrimitive.Trigger;
const Close = DrawerPrimitive.Close;

type ContentProps = React.ComponentProps<typeof DrawerPrimitive.Content> & {
  /** Render the visible drag handle at the top of the sheet. Default true.
   *  Hide it for surfaces that need a custom header strip (e.g. confirm-
   *  end with the end number rendered in the handle row). */
  showHandle?: boolean;
};

function Content({
  className,
  children,
  showHandle = true,
  ...props
}: ContentProps) {
  return (
    <DrawerPrimitive.Portal data-slot="bottom-sheet-portal">
      <DrawerPrimitive.Overlay
        data-slot="bottom-sheet-overlay"
        className="fixed inset-0 z-50 bg-ink/55 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DrawerPrimitive.Content
        data-slot="bottom-sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-3xl bg-bone",
          "border-t border-border shadow-[0_-12px_32px_-8px_rgba(10,10,10,0.18)]",
          // Safe-area padding so the bottom-most action button stays
          // above the iOS home indicator.
          "pb-[max(20px,env(safe-area-inset-bottom))]",
          "data-open:animate-in data-open:slide-in-from-bottom",
          "data-closed:animate-out data-closed:slide-out-to-bottom",
          className,
        )}
        {...props}
      >
        {showHandle && (
          <div
            aria-hidden="true"
            data-slot="bottom-sheet-handle"
            className="mx-auto mt-1.5 h-1 w-11 shrink-0 rounded-full bg-border"
          />
        )}
        {/* DialogTitle/Description are required for a11y when used; surfaces
            that render a heading in their own markup inside `children` should
            wrap it in <BottomSheet.Title /> from this module. */}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

const Title = DrawerPrimitive.Title;
const Description = DrawerPrimitive.Description;

export const BottomSheet = Object.assign(Root, {
  Trigger,
  Close,
  Content,
  Title,
  Description,
});
