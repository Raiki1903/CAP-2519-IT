/**
 * Progress bar: a horizontal bar filled to a percentage. Not built on Radix, unlike most files here.
 * Layer: shared (UI primitive). Called by feature components and pages across web/ (and src/app/components/ITSDashboard.tsx). Calls ui/utils.ts.
 * Used by: every role.
 */
import * as React from "react";
import { cn } from "./utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

/** Bar filled to `value` percent (0 to 100, default 0). */
export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-slate-100",
        className
      )}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-[#005A36] transition-all duration-300 ease-in-out"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  )
);
Progress.displayName = "Progress";
