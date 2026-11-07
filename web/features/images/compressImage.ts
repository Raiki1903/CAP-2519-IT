/**
 * Photo shrinker: turns a picked image file into a small JPEG data URL before it is saved.
 * Layer: feature helper. Called by features/assets (IntakeWizard, EditAssetDialog), features/inspections (InspectionQueue), pages/custodian/CustodianPortal.tsx, pages/auth/Register.tsx, pages/AccountDetailsPage.tsx.
 * Calls: the browser's createImageBitmap and canvas. Calls no server code.
 * Used by: Staff asset photos, inspection photos, Researcher self reports, profile pictures.
 */

/** Longest side, in pixels, of an asset, inspection, or issue report photo. */
export const ASSET_PHOTO_MAX_SIDE = 1280;

/** Longest side, in pixels, of a profile picture. */
export const PROFILE_PHOTO_MAX_SIDE = 512;

/** JPEG quality from 0 to 1. At 0.8 a photo is much smaller and still looks clean on a card or in a modal. */
const JPEG_QUALITY = 0.8;

/** The sentence a screen shows when a picked file cannot be turned into a photo. */
export const PHOTO_UNREADABLE_MESSAGE = "This photo couldn't be read. Try a JPG or PNG.";

/**
 * Shrinks an image file and returns it as a JPEG data URL.
 * The longest side is scaled down to `maxSide` and never scaled up. The canvas is filled white first,
 * because JPEG has no transparency and a transparent PNG would otherwise turn black.
 * A file that cannot be decoded rejects, and the caller saves nothing: the original file is never used instead.
 *
 * @param file the file picked in an `<input type="file">`
 * @param maxSide the longest side allowed, in pixels: ASSET_PHOTO_MAX_SIDE or PROFILE_PHOTO_MAX_SIDE
 * @returns a `data:image/jpeg;base64,...` string
 * @throws Error if the file is not an image the browser can decode, or the canvas is not available
 */
export async function compressImage(file: File, maxSide: number): Promise<string> {
  // "from-image" applies the camera's rotation, so a phone photo is not saved sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The canvas is not available.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
