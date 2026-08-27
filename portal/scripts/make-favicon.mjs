/**
 * Génère favicon.ico (PNG embarqué) depuis src/app/icon.png, sans dépendance.
 * Place le fichier dans src/app/ et public/.
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "src", "app", "icon.png");
const appOut = join(root, "src", "app", "favicon.ico");
const publicOut = join(root, "public", "favicon.ico");

/**
 * Construit un .ico contenant une image PNG (format supporté navigateur / Google).
 * @param {Buffer} png
 * @param {number} size côté en pixels (lu depuis IHDR si possible)
 */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // count

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; // width
  entry[1] = size >= 256 ? 0 : size; // height
  entry[2] = 0; // color palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // offset to image data

  return Buffer.concat([header, entry, png]);
}

/** Lit width/height depuis IHDR PNG. */
function readPngSize(png) {
  if (png.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("Source non PNG");
  }
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

const png = readFileSync(sourcePath);
const { width, height } = readPngSize(png);
if (width !== height) {
  console.warn(`Attention: icon non carré (${width}x${height})`);
}
const ico = pngToIco(png, width);
writeFileSync(appOut, ico);
copyFileSync(appOut, publicOut);
console.log(`OK favicon.ico (${ico.length} octets) depuis ${width}x${height} → app/ + public/`);
