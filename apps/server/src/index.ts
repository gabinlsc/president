import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientEvents, ServerEvents } from '@president/shared';
const http = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'ok' })); }
  else { res.writeHead(404); res.end('Not found'); }
});
new Server<ClientEvents, ServerEvents>(http, { cors: { origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' } });
http.listen(Number(process.env.PORT ?? 3001), () => console.log('Le Président — serveur prêt sur :3001'));
