import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FORCE = process.argv.includes('--force');
const SIZES = [256, 128, 56];
const CDN = 'https://render.worldofwarcraft.com/us/icons';

const specsFile = fileURLToPath(new URL('../public/specs.json', import.meta.url));
const iconsDir = fileURLToPath(new URL('../public/icons/', import.meta.url));

await mkdir(iconsDir, { recursive: true });

const { specializations } = JSON.parse(await readFile(specsFile, 'utf8'));

let ok = 0;
const failed = [];

for (const spec of specializations) {
  const outPath = path.join(iconsDir, `${spec.icon}.jpg`);

  if (!FORCE) {
    try {
      const existing = await readFile(outPath);
      if (existing.byteLength > 0) {
        ok++;
        continue;
      }
    } catch {
      // not downloaded yet
    }
  }

  let done = false;
  for (const size of SIZES) {
    const url = `${CDN}/${size}/${spec.blizzIcon}.jpg`;
    try {
      const res = await fetch(url);
      if (!res.ok || !res.headers.get('content-type')?.includes('image')) continue;
      await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
      console.log(`ok   ${size}px  ${spec.icon}  <- ${spec.blizzIcon}`);
      done = true;
      break;
    } catch (err) {
      console.warn(`warn ${url}: ${err.message}`);
    }
  }
  if (done) ok++;
  else failed.push(spec);
}

console.log(`\n${ok}/${specializations.length} icons ready.`);
for (const f of failed) console.error(`FAIL ${f.class} ${f.name} (${f.blizzIcon})`);
process.exitCode = failed.length ? 1 : 0;
