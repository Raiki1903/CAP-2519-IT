/**
 * Short care guidelines per group of asset categories, shown with an asset's details and on the loan release.
 * Layer: shared. Imported by web/ (asset details, Accountability Form). Imports shared/enums/assetCategory.ts.
 * Used by: borrowers and TSG.
 */
import type { AssetCategory } from '../enums/assetCategory';

/** One group of categories that share their care lines. */
export interface CareGuidelineGroup {
  /** The group's name, as a heading. */
  name: string;
  categories: readonly AssetCategory[];
  /** Two or three short lines. */
  lines: readonly string[];
}

/** Every category is in exactly one group. */
export const CARE_GUIDELINE_GROUPS: readonly CareGuidelineGroup[] = [
  {
    name: "Computers",
    categories: ["CPU"],
    lines: [
      "Keep the vents clear and use it on a hard, flat surface.",
      "Shut it down properly before moving or packing it.",
      "Do not install software that is not needed for the project.",
    ],
  },
  {
    name: "Tablets and VR headsets",
    categories: ["TABLET", "VR"],
    lines: [
      "Charge it with the supplied charger and do not leave it at 0% for long.",
      "Keep lenses and screens covered when not in use.",
    ],
  },
  {
    name: "Storage",
    categories: ["HARD_DRIVE", "MEMORY_CARD"],
    lines: [
      "Eject it safely before unplugging it.",
      "Keep it away from magnets, heat and moisture.",
      "Back up project data elsewhere: storage can fail without warning.",
    ],
  },
  {
    name: "Network equipment",
    categories: ["ROUTER", "SWITCH"],
    lines: [
      "Keep it ventilated and off the floor.",
      "Do not change its settings without telling TSG.",
    ],
  },
  {
    name: "Dev kits and simulators",
    categories: ["DEV_KIT", "SIMULATOR"],
    lines: [
      "Handle boards by their edges and store them in their antistatic bags.",
      "Check the voltage before connecting a power supply.",
      "Keep sensors and moving parts free of dust.",
    ],
  },
  {
    name: "Displays and projectors",
    categories: ["MONITOR", "TV", "PROJECTOR"],
    lines: [
      "Clean screens with a dry, soft cloth only.",
      "Let a projector cool down before moving it.",
    ],
  },
  {
    name: "Cameras and recorders",
    categories: ["CAMERA", "VIDEO_CAMERA", "RECORDER"],
    lines: [
      "Keep the lens cap on and the strap around your wrist or neck.",
      "Remove the battery when storing it for more than a week.",
    ],
  },
  {
    name: "Audio",
    categories: ["AUDIO", "SPEAKER"],
    lines: [
      "Turn the volume down before switching it on or off.",
      "Coil cables loosely; do not bend them sharply.",
    ],
  },
  {
    name: "Peripherals",
    categories: ["KEYBOARD", "MOUSE", "PRINTER"],
    lines: [
      "Keep food and drinks away from it.",
      "Use only the paper and ink TSG supplies for printers.",
    ],
  },
];

/**
 * The care lines for one category.
 *
 * @param category an asset category
 * @returns its group's lines, or [] for a category in no group
 */
export function careGuidelinesFor(category: AssetCategory): readonly string[] {
  return CARE_GUIDELINE_GROUPS.find(g => g.categories.includes(category))?.lines ?? [];
}
