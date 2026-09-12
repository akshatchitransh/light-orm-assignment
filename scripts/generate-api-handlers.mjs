import fs from 'fs';
import path from 'path';

function generateHandlers(baseDir) {
  fs.mkdirSync(path.join(baseDir, 'telemetry'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, 'todos'), { recursive: true });

  fs.writeFileSync(path.join(baseDir, 'todos.js'), `import app from './index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/todos') && !req.url.startsWith('/todos')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/todos' + query;
  }
  return app(req, res);
}
`);

  fs.writeFileSync(path.join(baseDir, 'stats.js'), `import app from './index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/stats') && !req.url.startsWith('/stats')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/stats' + query;
  }
  return app(req, res);
}
`);

  fs.writeFileSync(path.join(baseDir, 'telemetry/queries.js'), `import app from '../index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/telemetry/queries') && !req.url.startsWith('/telemetry/queries')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/telemetry/queries' + query;
  }
  return app(req, res);
}
`);

  fs.writeFileSync(path.join(baseDir, 'seed.js'), `import app from './index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/seed') && !req.url.startsWith('/seed')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/seed' + query;
  }
  return app(req, res);
}
`);

  fs.writeFileSync(path.join(baseDir, 'raw-query.js'), `import app from './index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/raw-query') && !req.url.startsWith('/raw-query')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/raw-query' + query;
  }
  return app(req, res);
}
`);

  fs.writeFileSync(path.join(baseDir, 'todos-completed.js'), `import app from './index.js';

export default function handler(req, res) {
  if (!req.url.startsWith('/api/todos-completed') && !req.url.startsWith('/todos-completed')) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/todos-completed' + query;
  }
  return app(req, res);
}
`);

  fs.writeFileSync(path.join(baseDir, 'todos/[id].js'), `import app from '../index.js';

export default function handler(req, res) {
  const id = req.query?.id || req.params?.id;
  if (id && !req.url.includes('/todos/' + id)) {
    const qIdx = req.url.indexOf('?');
    const query = qIdx !== -1 ? req.url.slice(qIdx) : '';
    req.url = '/todos/' + id + query;
  }
  return app(req, res);
}
`);

  fs.writeFileSync(path.join(baseDir, '[...path].js'), `import app from './index.js';

export default function handler(req, res) {
  return app(req, res);
}
`);
}

generateHandlers('api');
generateHandlers('apps/todo-app/api');
if (fs.existsSync('api/index.js')) {
  fs.copyFileSync('api/index.js', 'apps/todo-app/api/index.js');
}
if (fs.existsSync('vercel.json')) {
  fs.copyFileSync('vercel.json', 'apps/todo-app/vercel.json');
}
console.log('Successfully generated route handlers in api/ and apps/todo-app/api/');

