import app from './index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/stats') && !req.url.startsWith('/stats')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/stats' + query;
  }
  return app(req, res);
}
