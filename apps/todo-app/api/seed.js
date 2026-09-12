import app from './index.js';

export default function handler(req, res) {
  return new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    res.on('error', reject);
    if (!req.url.startsWith('/api/seed') && !req.url.startsWith('/seed')) {
      const qIdx = req.url.indexOf('?');
      const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
      req.url = '/seed' + query;
    }
    app(req, res);
  });
}
