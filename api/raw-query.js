import app from './index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/raw-query') && !req.url.startsWith('/raw-query')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/raw-query' + query;
  }
  return app(req, res);
}
