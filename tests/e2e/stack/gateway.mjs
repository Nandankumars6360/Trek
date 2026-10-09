// Tiny stand-in for the Supabase API gateway: routes /auth/v1 → Supabase Auth, /rest/v1 → PostgREST.
// Test harness only — production uses your Supabase project.
import http from 'node:http';

const routes = [
  ['/auth/v1', Number(process.env.AUTH_PORT ?? 9999)],
  ['/rest/v1', Number(process.env.REST_PORT ?? 3001)],
];
const port = Number(process.env.GATEWAY_PORT ?? 54321);

http.createServer((req, res) => {
  const hit = routes.find(([prefix]) => req.url.startsWith(prefix));
  if (!hit) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"message":"not routed in test gateway"}'); }
  const [prefix, target] = hit;
  const headers = { ...req.headers, host: `127.0.0.1:${target}` };
  const up = http.request({ host: '127.0.0.1', port: target, method: req.method, path: req.url.slice(prefix.length) || '/', headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(port, '127.0.0.1', () => console.log(`gateway on :${port}`));
