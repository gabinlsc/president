import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function serveStatic(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
  } catch {
    return false;
  }
  const file = pathname === '/' ? resolve(root, 'index.html') : resolve(root, `.${pathname}`);
  // Refuse anything resolving outside the public directory (e.g. encoded "../").
  if (!file.startsWith(root + sep)) return false;
  if (!(await stat(file).catch(() => null))?.isFile()) return false;
  const content = await readFile(file);
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(file)] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': file.includes(`${sep}assets${sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });
  res.end(content);
  return true;
}

export function createHttpServer(staticDir: string | null): Server {
  const root = staticDir ? resolve(staticDir) : null;
  return createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    const served =
      root && req.method === 'GET' ? serveStatic(root, req, res) : Promise.resolve(false);
    void served
      .catch(() => false)
      .then((ok) => {
        if (ok) return;
        res.writeHead(404);
        res.end('Not found');
      });
  });
}
