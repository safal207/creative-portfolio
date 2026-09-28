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

const casePath = path.join(root, 'cases', 'put', 'index.html');
const caseHtml = await readFile(casePath, 'utf8');
const caseIds = new Set([...caseHtml.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
for (const [, value] of caseHtml.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
  if (value.startsWith('#')) {
    if (!caseIds.has(value.slice(1))) failures.push(`PUT case missing anchor: ${value}`);
  } else if (!/^(https?:|mailto:|data:)/.test(value)) {
    const target = path.resolve(path.dirname(casePath), value.split(/[?#]/, 1)[0]);
    if (!target.startsWith(root + path.sep)) failures.push(`PUT case reference escapes dist: ${value}`);
    else {
      try { await stat(target); }
      catch { failures.push(`PUT case missing local file: ${value}`); }
    }
  }
}
for (const [, tag] of caseHtml.matchAll(/(<img\b[^>]*>)/g)) {
  if (!/\balt="[^"]+"/.test(tag)) failures.push('PUT case image lacks nonempty alt');
}
if (!/width=device-width/.test(caseHtml)) failures.push('PUT case missing responsive viewport');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`OK: main page and PUT case, ${ids.size} main anchors, ${images.length} main images, local files, and accessibility basics`);
}
