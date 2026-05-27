import { createHash } from "crypto";

export function hashKey(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function addressCacheKey(rawAddress: string, zipcode: string): string {
  const normalized = `${zipcode}:${rawAddress.toLowerCase().trim()}`;
  return `addr:v1:${hashKey(normalized)}`;
}

export function nameCacheKey(rawName: string): string {
  const normalized = rawName.trim();
  return `name:v1:${hashKey(normalized)}`;
}

export function zipCacheKey(zipcode: string): string {
  return `zip:v1:${zipcode.replace(/[\s\-]/g, "")}`;
}

export function itemCacheKey(rawDescription: string, hsCode: string): string {
  const normalized = `${hsCode}:${rawDescription.toLowerCase().trim()}`;
  return `item:v1:${hashKey(normalized)}`;
}
