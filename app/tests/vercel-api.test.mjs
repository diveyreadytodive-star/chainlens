import test from 'node:test';
import assert from 'node:assert/strict';
import health from '../api/health.mjs';
import examples from '../api/examples.mjs';
import interpret from '../api/interpret.mjs';

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: undefined,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; }
  };
}

test('Vercel health and examples handlers expose the local service contract', async () => {
  const healthResponse = response();
  await health({method: 'GET', headers: {}}, healthResponse);
  assert.equal(healthResponse.statusCode, 200);
  assert.equal(healthResponse.payload.ok, true);

  const examplesResponse = response();
  await examples({method: 'GET', headers: {}}, examplesResponse);
  assert.equal(examplesResponse.statusCode, 200);
  assert.equal(examplesResponse.payload.examples.length, 4);
});

test('Vercel interpret handler rejects invalid inputs and origins before RPC', async () => {
  const invalid = response();
  await interpret({method: 'POST', headers: {'content-type': 'application/json'}, body: {input: 'not-a-hash'}}, invalid);
  assert.equal(invalid.statusCode, 400);

  const hostile = response();
  await interpret({method: 'POST', headers: {origin: 'https://evil.example', host: 'chainlens.example', 'x-forwarded-proto': 'https', 'content-type': 'application/json'}, body: {input: 'not-a-hash'}}, hostile);
  assert.equal(hostile.statusCode, 403);

  const extension = `chrome-extension://${'a'.repeat(32)}`;
  const options = response();
  await interpret({method: 'OPTIONS', headers: {origin: extension, 'access-control-request-method': 'POST'}}, options);
  assert.equal(options.statusCode, 204);
  assert.equal(options.headers['access-control-allow-origin'], extension);
});
