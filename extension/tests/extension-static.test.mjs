import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { explorerUrl, isTransactionHash, parseTransactionInput, trustedEvidenceUrl } from '../core/input-parser.js';

const here = dirname(fileURLToPath(import.meta.url));
const extensionDir = join(here, '..');

async function recursiveFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => entry.isDirectory() ? recursiveFiles(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

test('parser accepts only Ethereum hashes and intended explorer transaction URLs', () => {
  const hash = `0x${'a'.repeat(64)}`;
  assert.equal(isTransactionHash(hash), true);
  assert.equal(parseTransactionInput(`  ${hash} `), hash);
  assert.equal(parseTransactionInput(`https://etherscan.io/tx/${hash}`), hash);
  assert.equal(parseTransactionInput(`https://eth.blockscout.com/tx/${hash}/`), hash);
  assert.equal(explorerUrl(hash), `https://etherscan.io/tx/${hash}`);
  assert.equal(trustedEvidenceUrl(`https://etherscan.io/tx/${hash}#eventlog`, hash), `https://etherscan.io/tx/${hash}#eventlog`);
  for (const unsafeUrl of [`javascript:alert(1)`, `https://example.com/tx/${hash}`, `https://etherscan.io/address/${hash}`, `https://etherscan.io/tx/${hash}?redirect=1`]) {
    assert.equal(trustedEvidenceUrl(unsafeUrl, hash), null);
  }
  for (const bad of ['0xabc', `https://sepolia.etherscan.io/tx/${hash}`, `http://etherscan.io/tx/${hash}`, `https://etherscan.io/address/${hash}`, `https://etherscan.io/tx/${hash}@evil.example`]) {
    assert.throws(() => parseTransactionInput(bad));
  }
});

test('manifest has only the approved minimum permissions and production API host', async () => {
  const manifest = JSON.parse(await readFile(join(extensionDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, '116');
  assert.deepEqual(manifest.permissions, ['activeTab', 'contextMenus', 'scripting', 'sidePanel', 'storage']);
  assert.deepEqual(manifest.host_permissions, ['https://chainlens-lyart.vercel.app/*']);
  assert.equal(manifest.background.type, 'module');
  assert.match(manifest.content_security_policy.extension_pages, /^script-src 'self'; object-src 'self'$/);
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: ['content/quick-receipt.css'],
    matches: ['<all_urls>'],
    use_dynamic_url: true
  }]);
  for (const path of Object.values(manifest.icons)) {
    assert.ok((await stat(join(extensionDir, path))).size > 0, `${path} must be a non-empty icon`);
  }
  assert.deepEqual(manifest.action.default_icon, {
    '16': 'icons/chainlens-16.png',
    '32': 'icons/chainlens-32.png',
    '48': 'icons/chainlens-48.png'
  });
});

test('extension source has no dynamic HTML sink, API-key literal, or remote executable source', async () => {
  const files = (await recursiveFiles(extensionDir)).filter(file => /\.(?:js|html|css|json|svg)$/.test(file) && !file.includes('/tests/'));
  const source = await Promise.all(files.map(file => readFile(file, 'utf8')));
  const joined = source.join('\n');
  assert.equal(joined.includes('inner' + 'HTML'), false);
  assert.equal(joined.includes('GROQ' + '_API_KEY'), false);
  assert.equal(/<script[^>]+src=["']https?:/i.test(joined), false);
  assert.equal(/import\s*\(\s*["']https?:/i.test(joined), false);
});
