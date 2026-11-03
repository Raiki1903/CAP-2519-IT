/**
 * The asset category values and their labels.
 * Layer: shared. Imported by server/features/assets/assets.service.ts (category sanitizing), server/features/lookups/lookups.service.ts,
 * shared/constants/careGuidelines.ts, and web/ (features/assets/IntakeWizard.tsx). Imports nothing.
 * Used by: asset registration and edit, and every screen that shows an asset's category.
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

/** One asset category. */
export type AssetCategory =
  | "DEV_KIT" | "MONITOR" | "TV" | "CPU" | "KEYBOARD" | "MOUSE" | "CAMERA"
  | "MEMORY_CARD" | "PROJECTOR" | "RECORDER" | "ROUTER" | "SIMULATOR"
  | "TABLET" | "VR" | "PRINTER" | "SWITCH" | "HARD_DRIVE" | "AUDIO"
  | "VIDEO_CAMERA" | "SPEAKER";

/** The label every screen shows for each category. */
export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  DEV_KIT: "Dev Kit",
  MONITOR: "Monitor",
  TV: "TV",
  CPU: "CPU",
  KEYBOARD: "Keyboard",
  MOUSE: "Mouse",
  CAMERA: "Camera",
  MEMORY_CARD: "Memory Card",
  PROJECTOR: "Projector",
  RECORDER: "Recorder",
  ROUTER: "Router",
  SIMULATOR: "Simulator",
  TABLET: "Tablet",
  VR: "VR",
  PRINTER: "Printer",
  SWITCH: "Switch",
  HARD_DRIVE: "Hard Drive",
  AUDIO: "Audio",
  VIDEO_CAMERA: "Video Camera",
  SPEAKER: "Speaker",
};
