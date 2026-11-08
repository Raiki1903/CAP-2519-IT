/**
 * The demo assets' pictures: a small SVG for each category (its name and a simple shape on a plain colour), as a
 * data URL for assets.image_url.
 * Layer: database tooling. Read by prisma/seed.ts. Imports Prisma's category type.
 * Used by: npm run seed.
 */
import type { assets_category } from "@prisma/client";

/** The shape drawn for a category, in a 320 by 240 box. Plain SVG, no text. */
const SHAPES = {
  screen: '<rect x="70" y="50" width="180" height="110" rx="6" fill="#fff" fill-opacity=".9"/><rect x="150" y="160" width="20" height="24" fill="#fff" fill-opacity=".9"/><rect x="120" y="184" width="80" height="8" rx="4" fill="#fff" fill-opacity=".9"/>',
  lens: '<rect x="85" y="75" width="150" height="100" rx="14" fill="#fff" fill-opacity=".9"/><circle cx="160" cy="125" r="34" fill="none" stroke-width="10" stroke-opacity=".35" stroke="#000"/><rect x="105" y="62" width="40" height="16" rx="4" fill="#fff" fill-opacity=".9"/>',
  board: '<rect x="80" y="65" width="160" height="110" rx="8" fill="#fff" fill-opacity=".9"/><g fill="#000" fill-opacity=".3"><rect x="100" y="85" width="40" height="40"/><rect x="155" y="85" width="12" height="12"/><rect x="175" y="85" width="12" height="12"/><rect x="195" y="85" width="12" height="12"/><rect x="155" y="140" width="65" height="14"/></g>',
  box: '<rect x="105" y="45" width="110" height="150" rx="8" fill="#fff" fill-opacity=".9"/><g fill="#000" fill-opacity=".3"><rect x="125" y="70" width="70" height="8"/><rect x="125" y="88" width="70" height="8"/><circle cx="160" cy="160" r="10"/></g>',
  round: '<circle cx="160" cy="120" r="70" fill="#fff" fill-opacity=".9"/><circle cx="160" cy="120" r="34" fill="#000" fill-opacity=".25"/>',
  pad: '<rect x="75" y="70" width="170" height="110" rx="22" fill="#fff" fill-opacity=".9"/><rect x="105" y="95" width="110" height="60" rx="8" fill="#000" fill-opacity=".25"/>',
} as const;

/** Each category's label, shape and background colour. */
const CATEGORY_LOOK: Record<assets_category, { label: string; shape: keyof typeof SHAPES; colour: string }> = {
  DEV_KIT: { label: "Dev Kit", shape: "board", colour: "#2f7d5b" },
  MONITOR: { label: "Monitor", shape: "screen", colour: "#3b5b92" },
  TV: { label: "TV", shape: "screen", colour: "#4a4f9c" },
  CPU: { label: "CPU", shape: "box", colour: "#475569" },
  KEYBOARD: { label: "Keyboard", shape: "pad", colour: "#64748b" },
  MOUSE: { label: "Mouse", shape: "round", colour: "#6b7280" },
  CAMERA: { label: "Camera", shape: "lens", colour: "#9a4f2c" },
  MEMORY_CARD: { label: "Memory Card", shape: "box", colour: "#8a6d1f" },
  PROJECTOR: { label: "Projector", shape: "lens", colour: "#7c3f8c" },
  RECORDER: { label: "Recorder", shape: "round", colour: "#8c3f5a" },
  ROUTER: { label: "Router", shape: "board", colour: "#1f6f8b" },
  SIMULATOR: { label: "Simulator", shape: "round", colour: "#a03a3a" },
  TABLET: { label: "Tablet", shape: "pad", colour: "#2c6e8f" },
  VR: { label: "VR", shape: "pad", colour: "#5b3f8c" },
  PRINTER: { label: "Printer", shape: "box", colour: "#5d6b3a" },
  SWITCH: { label: "Switch", shape: "board", colour: "#2d5f73" },
  HARD_DRIVE: { label: "Hard Drive", shape: "box", colour: "#4b5563" },
  AUDIO: { label: "Audio", shape: "round", colour: "#7a4a1f" },
  VIDEO_CAMERA: { label: "Video Camera", shape: "lens", colour: "#8a3a2c" },
  SPEAKER: { label: "Speaker", shape: "round", colour: "#336b45" },
};

/**
 * The category's picture as a data:image/svg+xml;base64 URL, well under 2 KB.
 *
 * @param category the asset's category
 */
export function categoryPicture(category: assets_category): string {
  const look = CATEGORY_LOOK[category];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">` +
    `<rect width="320" height="240" fill="${look.colour}"/>${SHAPES[look.shape]}` +
    `<text x="160" y="226" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#fff">${look.label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
