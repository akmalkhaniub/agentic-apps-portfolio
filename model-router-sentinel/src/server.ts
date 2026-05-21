import { serve } from '@hono/node-server';
import app from './index.js';
import { env } from './env.js';

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 Model Router Sentinel running on http://localhost:${info.port}`);
});
