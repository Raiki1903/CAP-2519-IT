/**
 * Class name helper for the UI primitives and every component that styles with Tailwind.
 * Layer: shared (UI utility, shadcn). Called by feature components and pages across web/ (and src/app/components/ITSDashboard.tsx). Calls clsx and tailwind-merge.
 * Used by: every role.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names, skipping falsy ones, and lets a later Tailwind class override an earlier
 * one of the same kind (so a caller's `className` can replace a primitive's default).
 *
 * @param inputs strings, arrays, or objects of class names, as clsx accepts
 * @returns one class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
