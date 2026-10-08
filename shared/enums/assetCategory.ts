/**
 * The asset category values.
 * Layer: shared. Imported by server/remainingRoutes.ts (category sanitizing) and web/ (features/assets/IntakeWizard.tsx). Imports nothing.
 * Used by: asset registration and edit.
 */

/**
 * Valid asset categories. Must match the `assets_category` enum in schema.prisma,
 * because the server writes these values straight into that column.
 */
export const ASSET_CATEGORIES = [
  "DEV_KIT", "MONITOR", "TV", "CPU", "KEYBOARD", "MOUSE", "CAMERA",
  "MEMORY_CARD", "PROJECTOR", "RECORDER", "ROUTER", "SIMULATOR",
  "TABLET", "VR", "PRINTER", "SWITCH", "HARD_DRIVE", "AUDIO",
  "VIDEO_CAMERA", "SPEAKER"
];
