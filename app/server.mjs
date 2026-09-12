import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {apiError, configuredExtensionOrigins, createInterpreterService, rpcProviderLabel, tokenMetadata} from './lib/service.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4186);
const configuredRpc = process.env.ETHEREUM_RPC_URL;
const rpcEndpoints = configuredRpc ? [configuredRpc] : undefined;

export {configuredExtensionOrigins, rpcProviderLabel, tokenMetadata};

function send(response, status, data) {
  response.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  response.end(JSON.stringify(data));
}

async function body(request) {
  let data = '';
  for await (const chunk of request) { data += chunk; if (Buffer.byteLength(data) > 8192) throw new Error('BODY_TOO_LARGE'); }
  try { return JSON.parse(data); } catch { throw new Error('BAD_JSON'); }
}

const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/landing.css', ['landing.css', 'text/css; charset=utf-8']],
  ['/demo-transactions.html', ['demo-transactions.html', 'text/html; charset=utf-8']],
  ['/demo-transactions.css', ['demo-transactions.css', 'text/css; charset=utf-8']],
  ['/demo-fields.css', ['demo-fields.css', 'text/css; charset=utf-8']],
  ['/downloads/chainlens-extension.zip', ['downloads/chainlens-extension.zip', 'application/zip']]
]);

export function createServer({serverPort = port, extensionOrigins = configuredExtensionOrigins(), rpcEndpoints: selectedRpcEndpoints = rpcEndpoints, configuredRpc: selectedConfiguredRpc = configuredRpc, service} = {}) {
  const interpreterService = service || createInterpreterService({rpcEndpoints: selectedRpcEndpoints, configuredRpc: selectedConfiguredRpc});
  let server;
  const localHosts = () => {
    const listeningPort = server?.address()?.port || serverPort;
    return [`127.0.0.1:${listeningPort}`, `localhost:${listeningPort}`];
  };
  const originAllowed = origin => localHosts().some(host => origin === `http://${host}`) || extensionOrigins.includes(origin);
  server = http.createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      if (!localHosts().includes(request.headers.host)) return send(response, 403, {error: '로컬 서비스 주소로 접속해 주세요.'});
      const url = new URL(request.url, 'http://127.0.0.1');
      const origin = request.headers.origin;
      if (url.pathname === '/api/interpret') {
        if (origin && !originAllowed(origin)) return send(response, 403, {error: '요청 출처가 허용되지 않습니다.'});
        if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
        if (request.method === 'OPTIONS') {
          if (request.headers['access-control-request-method'] !== 'POST') return send(response, 405, {error: 'POST 요청만 허용됩니다.'});
          response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          response.setHeader('Access-Control-Max-Age', '600');
          response.writeHead(204); return response.end();
        }
      }
      if (request.method === 'GET' && url.pathname === '/api/health') return send(response, 200, interpreterService.health());
      if (request.method === 'GET' && url.pathname === '/api/examples') return send(response, 200, {examples: await interpreterService.examples()});
      if (request.method === 'POST' && url.pathname === '/api/interpret') {
        if (!request.headers['content-type']?.startsWith('application/json')) return send(response, 415, {error: 'JSON 요청이 필요합니다.'});
        return send(response, 200, await interpreterService.interpret(await body(request)));
      }
      if (request.method === 'GET' && staticFiles.has(url.pathname)) {
        const [file, type] = staticFiles.get(url.pathname);
        response.writeHead(200, {'Content-Type': type}); response.end(await readFile(join(root, 'public', file))); return;
      }
      send(response, 404, {error: '경로를 찾을 수 없습니다.'});
    } catch (error) {
      if (error.message === 'BODY_TOO_LARGE') return send(response, 400, {error: '입력이 너무 큽니다.'});
      if (error.message === 'BAD_JSON') return send(response, 400, {error: '요청 형식이 올바르지 않습니다.'});
      const result = apiError(error); send(response, result.status, {error: result.error});
    }
  });
  return server;
}

export const server = createServer();
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(port, '127.0.0.1', () => console.log(`ChainLens ready: http://127.0.0.1:${port}`));
