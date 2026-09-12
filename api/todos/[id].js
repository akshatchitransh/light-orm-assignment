import app from '../index.js';

export default function handler(req, res) {
  const id = req.query?.id || req.params?.id;
  if (id && !req.url.includes('/todos/' + id)) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/todos/' + id + query;
  }
  return app(req, res);
}
