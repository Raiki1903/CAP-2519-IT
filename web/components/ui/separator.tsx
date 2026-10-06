/**
 * Separator: a thin horizontal or vertical line, built on Radix Separator.
 * Layer: shared (UI primitive, shadcn). Called by feature components and pages across web/ (and src/app/components/ITSDashboard.tsx). Calls ui/utils.ts and Radix Separator.
 * Used by: every role.
 */
"use client";

import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "./utils";

/** Divider line. `orientation`: horizontal (default) or vertical. */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator-root"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
