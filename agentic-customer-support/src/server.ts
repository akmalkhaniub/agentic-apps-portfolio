import { serve } from '@hono/node-server';
import app from './index';
import { env } from './env';

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`🚀 Customer Support Agent running on http://localhost:${info.port}`);
});
