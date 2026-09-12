export function sendJson(response, status, payload) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.status(status).json(payload);
}

export function methodNotAllowed(response, allowed) {
  response.setHeader('Allow', allowed);
  return sendJson(response, 405, {error: `${allowed} 요청만 허용됩니다.`});
}

const extensionOriginPattern = /^chrome-extension:\/\/[a-p]{32}$/;

export function allowPublicApiRequest(request, response) {
  const origin = request.headers?.origin;
  if (!origin) return true;
  if (extensionOriginPattern.test(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    return true;
  }
  const host = request.headers?.['x-forwarded-host'] || request.headers?.host;
  const protocol = request.headers?.['x-forwarded-proto'] || 'https';
  return Boolean(host && origin === `${protocol}://${host}`);
}

export function preflight(request, response) {
  if (request.method !== 'OPTIONS') return false;
  if (!allowPublicApiRequest(request, response)) {
    sendJson(response, 403, {error: '요청 출처가 허용되지 않습니다.'});
    return true;
  }
  if (request.headers?.['access-control-request-method'] !== 'POST') {
    methodNotAllowed(response, 'POST');
    return true;
  }
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Max-Age', '600');
  response.status(204).end();
  return true;
}
