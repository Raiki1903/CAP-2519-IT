/**
 * Label: a form field label, built on Radix Label.
 * Layer: shared (UI primitive, shadcn). Called by feature components and pages across web/. Calls ui/utils.ts and Radix Label.
 * Used by: every role.
 */
"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "./utils";

/** Field label. Use `htmlFor` to tie it to its input. */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
