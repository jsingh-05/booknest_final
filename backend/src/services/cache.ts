import type { RedisClientType } from "redis";
import { createClient } from "redis";

type CacheClient = {
  get: (key: string) => Promise<string | null>;
  setex: (key: string, ttlSeconds: number, value: string) => Promise<void>;
};

class MemoryCache implements CacheClient {
  private store = new Map<string, { v: string; exp: number }>();
  async get(key: string) {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.exp) {
      this.store.delete(key);
      return null;
    }
    return hit.v;
  }
  async setex(key: string, ttlSeconds: number, value: string) {
    this.store.set(key, { v: value, exp: Date.now() + ttlSeconds * 1000 });
  }
}

let client: CacheClient | null = null;

export async function getCache(): Promise<CacheClient> {
  if (client) return client;
  const url = (process.env.REDIS_URL || "").trim();
  if (url) {
    try {
      const redis: RedisClientType = createClient({ url });
      await redis.connect();
      client = {
        async get(key: string) {
          return (await redis.get(key)) as string | null;
        },
        async setex(key: string, ttlSeconds: number, value: string) {
          await redis.setEx(key, ttlSeconds, value);
        },
      };
      return client;
    } catch {
      client = new MemoryCache();
      return client;
    }
  }
  client = new MemoryCache();
  return client;
}

