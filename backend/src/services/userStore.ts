import crypto from "crypto";
import { getHistoryDb } from "./historyStore";

export interface User {
  id: string;
  name: string;
  permissions: string[];
  active: number;
  created_at: string;
  last_used_at: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  webhook_enabled: number;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  countries: string[];
}

const ALL_PERMISSIONS = [
  "address",
  "name",
  "item",
  "cache",
  "compliance",
  "classify",
  "admin",
];

export function getAllPermissions(): string[] {
  return [...ALL_PERMISSIONS];
}

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function parseCountries(raw: unknown): string[] {
  try {
    if (typeof raw === "string") return JSON.parse(raw);
    return ["jp"];
  } catch { return ["jp"]; }
}

export function ensureUsersTable(): void {
  const db = getHistoryDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key_hash TEXT UNIQUE NOT NULL,
      permissions TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    )
  `);
  try {
    db.exec("ALTER TABLE users RENAME COLUMN api_key TO api_key_hash");
  } catch (_e) {
    // column already renamed or doesn't exist
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_api_key_hash ON users(api_key_hash)
  `);
  try { db.exec("ALTER TABLE users ADD COLUMN webhook_url TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN webhook_secret TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN webhook_enabled INTEGER DEFAULT 0"); } catch (_e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN company_name TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN contact_email TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN contact_phone TEXT"); } catch (_e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN countries TEXT DEFAULT '[\"jp\"]'"); } catch (_e) {}
}

function generateApiKey(): string {
  return "ch_" + crypto.randomBytes(24).toString("hex");
}

export function createUser(
  name: string,
  permissions: string[]
): { user: User; apiKey: string } {
  const db = getHistoryDb();
  const rawKey = generateApiKey();
  const hash = hashApiKey(rawKey);

  db.prepare(
    `INSERT INTO users (id, name, api_key_hash, permissions, active, created_at, last_used_at, webhook_secret)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    name,
    hash,
    JSON.stringify(permissions),
    1,
    new Date().toISOString(),
    null,
    "whsec_" + crypto.randomBytes(24).toString("hex")
  );

  const user = getUserByApiKey(rawKey)!;
  return { user, apiKey: rawKey };
}

export function getUserByApiKey(apiKey: string): User | null {
  const db = getHistoryDb();
  const hash = hashApiKey(apiKey);
  const row = db
    .prepare(
      "SELECT id, name, permissions, active, created_at, last_used_at, webhook_url, webhook_secret, webhook_enabled, company_name, contact_email, contact_phone, countries FROM users WHERE api_key_hash = ? AND active = 1"
    )
    .get(hash) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToUser(row);
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    permissions: JSON.parse(row.permissions as string),
    active: row.active as number,
    created_at: row.created_at as string,
    last_used_at: (row.last_used_at as string) || null,
    webhook_url: (row.webhook_url as string) || null,
    webhook_secret: (row.webhook_secret as string) || null,
    webhook_enabled: (row.webhook_enabled as number) || 0,
    company_name: (row.company_name as string) || null,
    contact_email: (row.contact_email as string) || null,
    contact_phone: (row.contact_phone as string) || null,
    countries: parseCountries(row.countries),
  };
}

export function getUserById(id: string): User | null {
  const db = getHistoryDb();
  const row = db
    .prepare(
      "SELECT id, name, permissions, active, created_at, last_used_at, webhook_url, webhook_secret, webhook_enabled, company_name, contact_email, contact_phone, countries FROM users WHERE id = ?"
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToUser(row);
}

export function listUsers(): User[] {
  const db = getHistoryDb();
  const rows = db
    .prepare(
      "SELECT id, name, permissions, active, created_at, last_used_at, webhook_url, webhook_secret, webhook_enabled, company_name, contact_email, contact_phone, countries FROM users ORDER BY created_at DESC"
    )
    .all() as Record<string, unknown>[];
  return rows.map(rowToUser);
}

export function updateUser(
  id: string,
  updates: { name?: string; permissions?: string[]; active?: number; webhook_url?: string | null; webhook_enabled?: number; company_name?: string | null; contact_email?: string | null; contact_phone?: string | null; countries?: string[] }
): User | null {
  const db = getHistoryDb();
  const existing = getUserById(id);
  if (!existing) return null;

  const newName = updates.name ?? existing.name;
  const newPermissions = updates.permissions ?? existing.permissions;
  const newActive = updates.active ?? existing.active;

  db.prepare(
    `UPDATE users SET name = ?, permissions = ?, active = ? WHERE id = ?`
  ).run(newName, JSON.stringify(newPermissions), newActive, id);

  if (updates.webhook_url !== undefined) {
    db.prepare(`UPDATE users SET webhook_url = ? WHERE id = ?`).run(updates.webhook_url, id);
  }
  if (updates.webhook_enabled !== undefined) {
    db.prepare(`UPDATE users SET webhook_enabled = ? WHERE id = ?`).run(updates.webhook_enabled, id);
  }
  if (updates.company_name !== undefined) {
    db.prepare(`UPDATE users SET company_name = ? WHERE id = ?`).run(updates.company_name, id);
  }
  if (updates.contact_email !== undefined) {
    db.prepare(`UPDATE users SET contact_email = ? WHERE id = ?`).run(updates.contact_email, id);
  }
  if (updates.contact_phone !== undefined) {
    db.prepare(`UPDATE users SET contact_phone = ? WHERE id = ?`).run(updates.contact_phone, id);
  }
  if (updates.countries !== undefined) {
    db.prepare(`UPDATE users SET countries = ? WHERE id = ?`).run(JSON.stringify(updates.countries), id);
  }

  return getUserById(id);
}

export function regenerateApiKey(
  id: string
): { user: User; apiKey: string } | null {
  const db = getHistoryDb();
  const existing = getUserById(id);
  if (!existing) return null;

  const rawKey = generateApiKey();
  const hash = hashApiKey(rawKey);

  db.prepare(`UPDATE users SET api_key_hash = ? WHERE id = ?`).run(hash, id);

  const user = getUserById(id);
  if (!user) return null;
  return { user, apiKey: rawKey };
}

export function setUserLastUsed(apiKey: string): void {
  const db = getHistoryDb();
  const hash = hashApiKey(apiKey);
  db.prepare(`UPDATE users SET last_used_at = ? WHERE api_key_hash = ?`).run(
    new Date().toISOString(),
    hash
  );
}

export function hasPermission(user: User, permission: string): boolean {
  return user.active === 1 && user.permissions.includes(permission);
}

export function deleteUser(id: string): boolean {
  const db = getHistoryDb();
  const existing = getUserById(id);
  if (!existing) return false;
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return true;
}
