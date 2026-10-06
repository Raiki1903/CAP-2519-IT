/**
 * Avatar: a round frame for a profile picture or initials. Not built on Radix, unlike most files here.
 * Layer: shared (UI primitive). Imported by no file today. Calls ui/utils.ts.
 * Used by: no screen today.
 */
import * as React from "react";
import { cn } from "./utils";

/** Round 40px frame that clips its content. */
export const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
));
Avatar.displayName = "Avatar";

/** Centered content for the avatar when there is no picture, such as initials. */
export const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";
