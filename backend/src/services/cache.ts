import Redis, { Redis as RedisClient } from "ioredis";
import { config } from "../core/config";

let client: RedisClient;

export function getRedisClient(): RedisClient {
  if (!client) {
    client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });
    client.on("error", () => {});
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const c = getRedisClient();
    const raw = await c.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T
): Promise<boolean> {
  try {
    const c = getRedisClient();
    await c.set(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function cacheDelete(key: string): Promise<boolean> {
  try {
    const c = getRedisClient();
    await c.del(key);
    return true;
  } catch {
    return false;
  }
}

export async function cacheIncr(key: string): Promise<number> {
  try {
    const c = getRedisClient();
    return await c.incr(key);
  } catch {
    return -1;
  }
}

export async function cacheScan(pattern: string, count = 50): Promise<string[]> {
  try {
    const c = getRedisClient();
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [nextCursor, found] = await c.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        count
      );
      cursor = nextCursor;
      keys.push(...found);
      if (cursor === "0") break;
    } while (cursor !== "0");
    return keys;
  } catch {
    return [];
  }
}

export async function cacheMultiGet(keys: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const c = getRedisClient();
    if (keys.length === 0) return result;
    const values = await c.mget(...keys);
    for (let i = 0; i < keys.length; i++) {
      const val = values[i];
      if (val !== null) {
        result.set(keys[i], val);
      }
    }
  } catch {
    // return empty map on failure
  }
  return result;
}

const SETTINGS_KEY = "settings:credentials";

let cachedSettings: Record<string, string> | null = null;

export async function getCredential(key: string): Promise<string> {
  if (!cachedSettings) {
    cachedSettings = (await cacheGet<Record<string, string>>(SETTINGS_KEY)) || {};
  }
  return cachedSettings[key] || process.env[key] || "";
}

export function clearCredentialCache(): void {
  cachedSettings = null;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch {
      // ignore disconnect errors
    }
  }
}
