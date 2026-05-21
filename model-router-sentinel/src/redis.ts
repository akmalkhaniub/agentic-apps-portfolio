import { Redis } from 'ioredis';
import { env } from './env.js';

export let redis: any = null;

if (env.REDIS_URL) {
  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) {
          console.warn('⚠️ Redis connection failed. Falling back to in-memory mode.');
          redis = null;
          return null;
        }
        return Math.min(times * 100, 2000);
      },
    });
    console.log('🔋 Redis client initialized successfully.');
  } catch (err) {
    console.error('⚠️ Redis connection error:', err);
    redis = null;
  }
} else {
  console.log('ℹ️ No REDIS_URL provided. Running in-memory mode.');
}
