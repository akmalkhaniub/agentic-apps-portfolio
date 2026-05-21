import { redis } from './redis.js';

interface CacheEntry {
  key: string;
  normalizedKey: string;
  response: unknown;
  createdAt: number;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export class SemanticCache {
  private entries: CacheEntry[] = [];
  private maxSize: number;
  private ttlMs: number;
  hits = 0;
  misses = 0;

  constructor(maxSize = 500, ttlMs = 30 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  async get(prompt: string): Promise<unknown | null> {
    const norm = normalize(prompt);
    const now = Date.now();

    let allEntries: CacheEntry[] = [];
    if (redis) {
      try {
        const raw = await redis.get('sentinel:cache:entries');
        if (raw) {
          allEntries = JSON.parse(raw);
        }
      } catch (err) {
        console.error('Redis cache get error, falling back to local memory', err);
        allEntries = this.entries;
      }
    } else {
      allEntries = this.entries;
    }

    for (const entry of allEntries) {
      if (now - entry.createdAt > this.ttlMs) continue;
      if (entry.normalizedKey === norm || similarity(entry.normalizedKey, norm) > 0.9) {
        if (redis) {
          try {
            await redis.incr('sentinel:cache:hits');
          } catch {
            // ignore
          }
        } else {
          this.hits++;
        }
        return entry.response;
      }
    }

    if (redis) {
      try {
        await redis.incr('sentinel:cache:misses');
      } catch {
        // ignore
      }
    } else {
      this.misses++;
    }
    return null;
  }

  async set(prompt: string, response: unknown): Promise<void> {
    const norm = normalize(prompt);
    const newEntry: CacheEntry = {
      key: prompt,
      normalizedKey: norm,
      response,
      createdAt: Date.now(),
    };

    if (redis) {
      try {
        const raw = await redis.get('sentinel:cache:entries');
        let allEntries: CacheEntry[] = raw ? JSON.parse(raw) : [];
        allEntries.push(newEntry);
        if (allEntries.length > this.maxSize) {
          allEntries = allEntries.slice(-this.maxSize);
        }
        await redis.set('sentinel:cache:entries', JSON.stringify(allEntries), 'EX', Math.ceil(this.ttlMs / 1000));
      } catch (err) {
        console.error('Redis cache set error, falling back to local memory', err);
        this.entries.push(newEntry);
        if (this.entries.length > this.maxSize) {
          this.entries = this.entries.slice(-this.maxSize);
        }
      }
    } else {
      this.entries.push(newEntry);
      if (this.entries.length > this.maxSize) {
        this.entries = this.entries.slice(-this.maxSize);
      }
    }
  }

  async stats() {
    let localHits = this.hits;
    let localMisses = this.misses;
    let entriesCount = this.entries.length;

    if (redis) {
      try {
        const rHits = await redis.get('sentinel:cache:hits');
        const rMisses = await redis.get('sentinel:cache:misses');
        const raw = await redis.get('sentinel:cache:entries');

        localHits = rHits ? Number(rHits) : 0;
        localMisses = rMisses ? Number(rMisses) : 0;
        entriesCount = raw ? JSON.parse(raw).length : 0;
      } catch {
        // ignore
      }
    }

    const total = localHits + localMisses;
    return {
      entries: entriesCount,
      hits: localHits,
      misses: localMisses,
      hitRate: total === 0 ? 0 : localHits / total,
    };
  }
}
