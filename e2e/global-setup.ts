import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Generates the fake camera clip once; it is git-ignored and ~14 MB. */
export default function globalSetup(): void {
  const clip = path.resolve(process.cwd(), 'e2e/fixtures/fake-cam.y4m');
  if (!existsSync(clip)) {
    execFileSync(process.execPath, [path.resolve(process.cwd(), 'e2e/fixtures/make-fake-camera.mjs')], { stdio: 'inherit' });
  }
}
