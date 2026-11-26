// F runnable sub-step: upload a real photo via "Add your photo" on a
// place card and confirm it attaches. (The screenshot-match PROPOSAL
// itself — match_screenshot — has zero hits in src/tests and there is
// no Album component, so Demo F as written is NOT RUNNABLE.)
import { launch, shot, bodyText } from './harness.mjs';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// Minimal valid 120x120 PNG (solid teal) built with node zlib.
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const W = 120, H = 120;
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  for (let x = 0; x < W; x++) {
    const o = y * (1 + W * 3) + 1 + x * 3;
    raw[o] = 0x2e; raw[o + 1] = 0x7d; raw[o + 2] = 0x5b; // teal
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync('/tmp/test-photo.png', png);
console.log('test png bytes:', png.length);

const { ctx, page } = await launch('demo-cef', 'F-upload');
await page.goto('http://127.0.0.1:4330/gta6-leonida-atlas/?place=L304', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const addPhoto = page.getByRole('button', { name: /Add your photo/i }).first();
console.log('"Add your photo" present:', await addPhoto.count());
// The button triggers a hidden file input — catch the chooser.
const chooserPromise = page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null);
await addPhoto.click();
const chooser = await chooserPromise;
console.log('file chooser opened:', !!chooser);
if (chooser) {
  await chooser.setFiles('/tmp/test-photo.png');
  await page.waitForTimeout(2500);
}
await shot(page, 'f04-photo-uploaded');
const t = await bodyText(page);
console.log('--- card after upload ---');
console.log(t.slice(0, 2200));
console.log('photo attached (img present / "Your photo"):', /Your photo|Remove photo|Change photo/i.test(t));
const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => (i.src || '').slice(0, 60)));
console.log('imgs on card:', JSON.stringify(imgs.slice(0, 8)));
await ctx.close();
console.log('F upload probe done');
