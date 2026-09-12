import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const extensionDir = resolve(import.meta.dirname, '..');
const output = resolve(extensionDir, '..', 'dist', 'chainlens-extension.zip');
mkdirSync(dirname(output), { recursive: true });
if (existsSync(output)) rmSync(output);
execFileSync('zip', ['-q', '-r', output, 'manifest.json', 'service-worker.js', 'core', 'content', 'sidepanel', 'icons'], { cwd: extensionDir });
const files = new Set(execFileSync('unzip', ['-Z1', output], { encoding: 'utf8' }).split('\n').filter(Boolean));
const extractDir = mkdtempSync(resolve(tmpdir(), 'chainlens-extension-'));
try {
  execFileSync('unzip', ['-qq', output, '-d', extractDir]);
  const manifest = JSON.parse(readFileSync(resolve(extractDir, 'manifest.json'), 'utf8'));
  const manifestPaths = [
    manifest.background?.service_worker,
    manifest.side_panel?.default_path,
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action?.default_icon || {}),
    ...(manifest.web_accessible_resources || []).flatMap(entry => entry.resources || [])
  ].filter(Boolean);
  for (const path of manifestPaths) {
    if (!files.has(path) || !statSync(resolve(extractDir, path)).isFile()) throw new Error(`Extension ZIP is missing manifest resource: ${path}`);
  }
} finally {
  rmSync(extractDir, { recursive: true, force: true });
}
process.stdout.write(`Created, extracted, and verified ${output}\n`);
