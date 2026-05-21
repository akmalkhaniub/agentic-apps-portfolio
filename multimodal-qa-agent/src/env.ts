import { z } from 'zod';
import 'dotenv/config';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  ANTHROPIC_API_KEY: z.string().default('mock-key'),
  NODE_ENV: z
    .string()
    .transform((val) => val.trim().replace(/\r/g, '').toLowerCase())
    .pipe(z.enum(['development', 'production', 'test']))
    .default('development'),
});

export const env = envSchema.parse(process.env);
