import app from './index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/todos') && !req.url.startsWith('/todos')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/todos' + query;
  }
  return app(req, res);
}
