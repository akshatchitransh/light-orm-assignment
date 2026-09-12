import app from './index.js';

export default function handler(req, res) {
  return new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    res.on('error', reject);
    if (!req.url.startsWith('/api/todos') && !req.url.startsWith('/todos')) {
      const qIdx = req.url.indexOf('?');
      const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
      req.url = '/todos' + query;
    }
    app(req, res);
  });
}
