// Downloads the on-device segmentation model into public/ml/models and records where it
// came from. Run once after cloning (`npm run ml:models`); the file is committed, so a
// normal build never needs the network for it. The hash is pinned: a changed upstream
// file fails loudly instead of silently shipping a different model.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/ml/models');

const MODELS = [
  {
    file: 'selfie_segmenter.tflite',
    url: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
    // Set on first download; later runs verify against it.
    sha256: '191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b',
    license: 'Apache-2.0 (MediaPipe, Google LLC)',
    notes: 'Selfie Segmenter, general 256x256 float16. Person vs background confidence masks.',
  },
];

mkdirSync(outDir, { recursive: true });
const provenance = ['# ML model provenance', '', 'Files in this folder are downloaded by `scripts/fetch-ml-models.mjs` and committed.', ''];

for (const m of MODELS) {
  const target = resolve(outDir, m.file);
  let bytes;
  if (existsSync(target) && !process.env.FORCE) {
    bytes = readFileSync(target);
    console.log(`${m.file}: already present (${bytes.length} bytes)`);
  } else {
    const res = await fetch(m.url);
    if (!res.ok) throw new Error(`${m.url} -> ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    writeFileSync(target, bytes);
    console.log(`${m.file}: downloaded ${bytes.length} bytes`);
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (m.sha256 && m.sha256 !== hash) throw new Error(`${m.file}: sha256 ${hash} does not match pinned ${m.sha256}`);
  provenance.push(`## ${m.file}`, '', `- Source: ${m.url}`, `- SHA-256: ${hash}`, `- Size: ${bytes.length} bytes`, `- License: ${m.license}`, `- Notes: ${m.notes}`, `- Fetched: ${new Date().toISOString().slice(0, 10)}`, '');
}
writeFileSync(resolve(outDir, 'PROVENANCE.md'), provenance.join('\n'));
console.log('PROVENANCE.md written');
