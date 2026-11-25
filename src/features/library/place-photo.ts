/**
 * A photo the user adds himself — his own in-game screenshot, from his
 * phone — downscaled on-device before it is stored (IndexedDB,
 * device-only, never in a backup, never uploaded).
 *
 * The rule (user, 2026-11-24): a photo of a building must be REAL. No
 * AI-generated image presented as a photo of the building, no scraped
 * image, no stock photo of a different building. Until the user adds
 * his own screenshot, the card shows a zoomed map crop of the actual
 * spot, labelled as the map — never as a photo.
 */

/** Downscale to at most 1024px on the long edge, JPEG 0.82. Returns
 * null when the file is not a readable image. */
export async function downscalePhoto(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > 1024 ? 1024 / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}
