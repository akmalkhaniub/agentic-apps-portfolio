import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export const envSchema = z.object({
  PORT: z.coerce.number().default(3002),
  DATABASE_URL: z
    .string()
    .transform((val) => {
      if (val.startsWith('postgresql:')) {
        return 'file:local.db';
      }
      return val;
    })
    .default('file:local.db'),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  NODE_ENV: z
    .string()
    .transform((val) => val.trim().replace(/\r/g, '').toLowerCase())
    .pipe(z.enum(['development', 'production', 'test']))
    .default('development'),
});

console.log('DEBUG: process.env.NODE_ENV =', JSON.stringify(process.env.NODE_ENV));
export const env = envSchema.parse(process.env);
