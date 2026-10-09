import { resolve } from 'node:path';
import { createAppServer } from './server';
const port = Number(process.env.PORT ?? 3001);
const app = createAppServer({ staticDir: resolve(process.env.STATIC_DIR ?? '../web/dist') });
app.http.listen(port, () => console.log(`Le Président — http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
