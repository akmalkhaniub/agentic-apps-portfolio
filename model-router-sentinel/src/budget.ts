import { redis } from './redis.js';

interface SpendRecord {
  apiKey: string;
  amount: number;
  model: string;
  timestamp: number;
}

export class BudgetTracker {
  private records: SpendRecord[] = [];
  private limits: Map<string, number> = new Map();
  private defaultLimit: number;

  constructor(defaultLimitUsd = 100) {
    this.defaultLimit = defaultLimitUsd;
  }

  async setLimit(apiKey: string, limitUsd: number): Promise<void> {
    if (redis) {
      try {
        await redis.hset('sentinel:budget:limits', apiKey, limitUsd.toString());
      } catch (err) {
        console.error('Redis setLimit error, falling back to local Map', err);
        this.limits.set(apiKey, limitUsd);
      }
    } else {
      this.limits.set(apiKey, limitUsd);
    }
  }

  async getLimit(apiKey: string): Promise<number> {
    if (redis) {
      try {
        const val = await redis.hget('sentinel:budget:limits', apiKey);
        if (val) return Number(val);
      } catch (err) {
        console.error('Redis getLimit error, falling back to local Map', err);
      }
    }
    return this.limits.get(apiKey) ?? this.defaultLimit;
  }

  async record(apiKey: string, amount: number, model: string): Promise<void> {
    const timestamp = Date.now();
    const record: SpendRecord = { apiKey, amount, model, timestamp };

    if (redis) {
      try {
        // Record raw transaction for logging/auditing
        await redis.lpush('sentinel:budget:records', JSON.stringify(record));
        await redis.ltrim('sentinel:budget:records', 0, 999); // cap logs at 1000

        // Increment monthly spend
        const currentMonthKey = this.getCurrentMonthKey();
        await redis.hincrbyfloat(`sentinel:budget:spend:${currentMonthKey}`, apiKey, amount);
      } catch (err) {
        console.error('Redis record error, falling back to local array', err);
        this.records.push(record);
      }
    } else {
      this.records.push(record);
    }
  }

  async getSpend(apiKey: string): Promise<number> {
    if (redis) {
      try {
        const currentMonthKey = this.getCurrentMonthKey();
        const val = await redis.hget(`sentinel:budget:spend:${currentMonthKey}`, apiKey);
        return val ? Number(val) : 0;
      } catch (err) {
        console.error('Redis getSpend error, falling back to local calculation', err);
      }
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const cutoff = monthStart.getTime();
    return this.records
      .filter((r) => r.apiKey === apiKey && r.timestamp >= cutoff)
      .reduce((sum, r) => sum + r.amount, 0);
  }

  async isOverBudget(apiKey: string): Promise<boolean> {
    const spend = await this.getSpend(apiKey);
    const limit = await this.getLimit(apiKey);
    return spend >= limit;
  }

  async spendByKey(): Promise<Record<string, number>> {
    if (redis) {
      try {
        const currentMonthKey = this.getCurrentMonthKey();
        const raw = await redis.hgetall(`sentinel:budget:spend:${currentMonthKey}`);
        const result: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw)) {
          result[k] = Number(v);
        }
        return result;
      } catch (err) {
        console.error('Redis spendByKey error, falling back to local calculation', err);
      }
    }

    const result: Record<string, number> = {};
    for (const r of this.records) {
      result[r.apiKey] = (result[r.apiKey] ?? 0) + r.amount;
    }
    return result;
  }

  private getCurrentMonthKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}`;
  }
}
