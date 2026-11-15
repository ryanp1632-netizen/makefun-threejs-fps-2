// SALTGLASS hand-in (Node 22, standard library only). The game is game/: static ES modules with
// three.js 0.187.0 vendored under game/vendor/three and mapped by index.html's import map. This
// program copies game/ and screenshots/ into the output directory and writes dossier.json with
// the kit's buildDossier, unchanged, so the gate can rebuild it byte for byte.
//
//   node serve.ts                                   play it at http://localhost:8080
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly here rather than at the gate: 3 or 4 screenshots, each a JPEG or PNG of at most
// 256 KiB with a plain file name.
const shots = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((name) => !name.startsWith('.')).sort()
  : [];
if (shots.length < 3 || shots.length > 4) throw new Error(`screenshots/ holds ${shots.length} images; 3 or 4 are needed`);
for (const name of shots) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name) || !/\.(png|jpe?g)$/i.test(name)) throw new Error(`bad screenshot name: ${name}`);
  if (statSync(join(here, 'screenshots', name)).size > 262144) throw new Error(`${name} is over 256 KiB`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps: the text the judge reads is capped at 160 KiB; at most 4 screenshots of
// 256 KiB; game/ within 993 entries and 48 MiB.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
