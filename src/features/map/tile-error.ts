/**
 * The tile-error image (v0.30.0): what a tile slot shows when its
 * tile failed to load and the service worker refused to substitute
 * ocean for it.
 *
 * Before v0.30 the error tile was ocean.jpg itself — a failed land
 * tile painted water over land, and nothing on screen could tell a
 * real sea tile from a broken land tile (v0.24 P0). This image is
 * deliberately NOT ocean: dark slate (#19232F, the app's Slate)
 * with a subtle diagonal hatch, so an unavailable tile reads as
 * "not loaded" at a glance, and the next pan retries it. It is an
 * inline SVG data URI (no network fetch, no cache entry, works
 * offline) sized to the 256px tile grid.
 */
export const TILE_ERROR_DATA_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">` +
      `<rect width="256" height="256" fill="#19232F"/>` +
      `<g stroke="#2A3648" stroke-width="2">` +
      `<line x1="-32" y1="32" x2="32" y2="-32"/>` +
      `<line x1="0" y1="64" x2="64" y2="0"/>` +
      `<line x1="32" y1="96" x2="96" y2="32"/>` +
      `<line x1="64" y1="128" x2="128" y2="64"/>` +
      `<line x1="96" y1="160" x2="160" y2="96"/>` +
      `<line x1="128" y1="192" x2="192" y2="128"/>` +
      `<line x1="160" y1="224" x2="224" y2="160"/>` +
      `<line x1="192" y1="256" x2="256" y2="192"/>` +
      `<line x1="224" y1="288" x2="288" y2="224"/>` +
      `</g>` +
      `</svg>`,
  );
