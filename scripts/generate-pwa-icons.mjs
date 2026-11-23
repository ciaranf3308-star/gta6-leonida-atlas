// Generates the PWA icons from the existing favicon SVG (run once, commit the PNGs).
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = join(root, "public", "favicon.svg");
const outDir = join(root, "public", "icons");
await mkdir(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(join(outDir, `icon-${size}.png`), png);
  console.log(`icons/icon-${size}.png (${png.length} bytes)`);
}
