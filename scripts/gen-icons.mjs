/**
 * Generuje ikony PNG dla PWA z pliku SVG fermly.svg
 * Uruchom raz: node scripts/gen-icons.mjs
 * Wymaga: npm install (zainstaluje @resvg/resvg-js z devDependencies)
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const svgPath = resolve(root, 'public/icons/fermly.svg');
const outDir  = resolve(root, 'public/icons');

mkdirSync(outDir, { recursive: true });

const svgSource = readFileSync(svgPath, 'utf8');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const resvg = new Resvg(svgSource, {
    fitTo: { mode: 'width', value: size },
  });
  const png = resvg.render().asPng();
  const outFile = resolve(outDir, `icon-${size}x${size}.png`);
  writeFileSync(outFile, png);
  console.log(`✓ icon-${size}x${size}.png`);
}

console.log('\n✅ Ikony wygenerowane w public/icons/');
