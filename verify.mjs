import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const css = await readFile(path.join(root, 'styles.css'), 'utf8');
const failures = [];
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

for (const [, value] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  if (value.startsWith('#')) {
    if (!ids.has(value.slice(1))) failures.push(`Missing anchor: ${value}`);
  } else if (!/^https?:\/\//.test(value)) {
    try { await stat(path.join(root, value)); }
    catch { failures.push(`Missing local file: ${value}`); }
  }
}

const images = [...html.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
for (const image of images) {
  if (!/\balt="[^"]+"/.test(image)) failures.push(`Image lacks nonempty alt: ${image}`);
  if (!/\bloading="lazy"|\bfetchpriority="high"/.test(image)) failures.push(`Image lacks loading hint: ${image}`);
}

if (!/prefers-reduced-motion/.test(css)) failures.push('Missing reduced-motion support');
if (!/focus-visible/.test(css)) failures.push('Missing visible keyboard focus');
if (!/width=device-width/.test(html)) failures.push('Missing responsive viewport');
if (!/<main id="main">/.test(html)) failures.push('Missing main landmark');

for (const marker of ['id="design"', 'id="games"', 'cases/put', 'figma.com', 'Roblox', 'Awakening', 'ТИШЕ']) {
  if (html.includes(marker)) failures.push(`Unrelated portfolio content remains: ${marker}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`OK: architecture page, ${ids.size} anchors, ${images.length} images, local files, and accessibility basics`);
}
