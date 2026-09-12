import {apiError, createInterpreterService} from '../lib/service.mjs';
import {allowPublicApiRequest, methodNotAllowed, preflight, sendJson} from './_http.mjs';

const service = createInterpreterService();

export default async function handler(request, response) {
  if (preflight(request, response)) return;
  if (request.method !== 'POST') return methodNotAllowed(response, 'POST');
  if (!allowPublicApiRequest(request, response)) return sendJson(response, 403, {error: '요청 출처가 허용되지 않습니다.'});
  if (!request.headers['content-type']?.startsWith('application/json')) return sendJson(response, 415, {error: 'JSON 요청이 필요합니다.'});
  try {
    if (Buffer.byteLength(JSON.stringify(request.body ?? null)) > 8192) return sendJson(response, 400, {error: '입력이 너무 큽니다.'});
    return sendJson(response, 200, await service.interpret(request.body));
  } catch (error) {
    const result = apiError(error);
    return sendJson(response, result.status, {error: result.error});
  }
}
