// ViceWire app icon (v0.21.0) — Option A, The Network / The Grid.
// A bold geometric "V" over a subtle cartographic layer, drawn as
// clean vector geometry. NOT lifted from the concept boards
// (workspace/user/files/1000017580_6_bdzo.png,
// 1000017579_7_l9g9.png) — those are AI concept renders, not
// production assets. Palette: navy #0E1A2B, ivory #F5E8D4,
// coral #EE657C, sunset #F5AC69.
//
// The V is two strokes meeting at the bottom point: the left stroke
// ivory, the right stroke a coral-to-sunset gradient. Behind it, a
// faint grid + contour lines — the map, without relying on literal
// scenery. The same SVG is written to public/favicon.svg; sharp
// renders the 192/512 PNGs (the maskable keeps the mark inside the
// central 80% safe zone).
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

const NAVY = '#0e1a2b';
const IVORY = '#f5e8d4';
const CORAL = '#ee657c';
const SUNSET = '#f5ac69';

function gridLines() {
  const lines = [];
  for (let i = 1; i < 8; i++) {
    const p = i * 64;
    lines.push(`<line x1="${p}" y1="0" x2="${p}" y2="512" />`);
    lines.push(`<line x1="0" y1="${p}" x2="512" y2="${p}" />`);
  }
  return `<g stroke="${IVORY}" stroke-opacity="0.07" stroke-width="1">${lines.join('')}</g>`;
}

function contours() {
  return `<g fill="none" stroke="${CORAL}" stroke-width="1.5">
    <path d="M-10,430 C90,400 150,470 260,430 S430,380 522,420" stroke-opacity="0.22" />
    <path d="M-10,470 C110,440 210,500 330,460 S470,430 522,460" stroke-opacity="0.14" />
    <path d="M40,60 C120,110 90,190 170,230" stroke-opacity="0.16" />
    <path d="M380,40 C430,110 400,180 460,240" stroke-opacity="0.16" />
  </g>`;
}

function vMark() {
  return `<g>
    <defs>
      <linearGradient id="vgrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${CORAL}" />
        <stop offset="1" stop-color="${SUNSET}" />
      </linearGradient>
    </defs>
    <path d="M96,120 L188,120 L256,300 L256,392 L210,392 Z" fill="${IVORY}" />
    <path d="M324,120 L416,120 L302,392 L256,392 L256,300 Z" fill="url(#vgrad)" />
  </g>`;
}

export function vicewireIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="${NAVY}" />
  <radialGradient id="glow" cx="0.8" cy="0.9" r="0.7">
    <stop offset="0" stop-color="${CORAL}" stop-opacity="0.25" />
    <stop offset="1" stop-color="${CORAL}" stop-opacity="0" />
  </radialGradient>
  <rect width="512" height="512" rx="112" fill="url(#glow)" />
  <clipPath id="clip"><rect width="512" height="512" rx="112" /></clipPath>
  <g clip-path="url(#clip)">
    ${gridLines()}
    ${contours()}
    ${vMark()}
  </g>
</svg>`;
}

/** The V mark alone, for the header wordmark and favicon. */
export function vicewireMarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="vgrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${CORAL}" />
      <stop offset="1" stop-color="${SUNSET}" />
    </linearGradient>
  </defs>
  <path d="M96,120 L188,120 L256,300 L256,392 L210,392 Z" fill="${IVORY}" />
  <path d="M324,120 L416,120 L302,392 L256,392 L256,300 Z" fill="url(#vgrad)" />
</svg>`;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const svg = vicewireIconSvg();
  await writeFile(join(root, 'public', 'favicon.svg'), vicewireMarkSvg(), 'utf8');
  await sharp(Buffer.from(svg)).png().toFile(join(outDir, 'icon-512.png'));
  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(join(outDir, 'icon-192.png'));
  // Maskable: the mark inside the central 80% safe zone, navy to the edge.
  const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${NAVY}" />
  <g transform="translate(51,51) scale(0.8)">
    <clipPath id="clip"><rect width="512" height="512" rx="112" /></clipPath>
    <g clip-path="url(#clip)">
      <rect width="512" height="512" fill="${NAVY}" />
      ${gridLines()}
      ${contours()}
      ${vMark()}
    </g>
  </g>
</svg>`;
  await sharp(Buffer.from(maskable)).png().toFile(join(outDir, 'icon-512-maskable.png'));
  console.log('ViceWire icons written to public/icons/');
}

await main();
