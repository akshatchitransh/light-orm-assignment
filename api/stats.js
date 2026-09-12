import app from './index.js';

export default function handler(req, res) {
  return new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    res.on('error', reject);
    if (!req.url.startsWith('/api/stats') && !req.url.startsWith('/stats')) {
      const qIdx = req.url.indexOf('?');
      const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
      req.url = '/stats' + query;
    }
    app(req, res);
  });
}
