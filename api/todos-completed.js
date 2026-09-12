import app from './index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/todos-completed') && !req.url.startsWith('/todos-completed')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/todos-completed' + query;
  }
  return app(req, res);
}
