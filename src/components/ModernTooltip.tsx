import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

interface ModernTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
}

/**
 * Compile Palace's tooltip primitive — reuses @radix-ui/react-tooltip
 * (already a dependency via components/ui/tooltip.tsx) for positioning,
 * collision-avoidance and focus-visible/keyboard behavior, but with the
 * app's own frosted-glass pill styling (`.cp-tooltip` in index.css) instead
 * of shadcn's generic popover look. Radix's Portal + collision detection is
 * what keeps this from being clipped by the editor/sidebar/top-bar
 * containers, so no separate positioning logic is needed here.
 */
export function ModernTooltip({ content, children, side = "top", sideOffset = 8 }: ModernTooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="cp-tooltip"
            side={side}
            sideOffset={sideOffset}
            collisionPadding={8}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
