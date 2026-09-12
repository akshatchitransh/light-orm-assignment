import app from '../index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/telemetry/queries') && !req.url.startsWith('/telemetry/queries')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/telemetry/queries' + query;
  }
  return app(req, res);
}
