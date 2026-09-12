import {methodNotAllowed, sendJson} from './_http.mjs';
import {createInterpreterService} from '../lib/service.mjs';

const service = createInterpreterService();

export default async function handler(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response, 'GET');
  return sendJson(response, 200, {examples: await service.examples()});
}
