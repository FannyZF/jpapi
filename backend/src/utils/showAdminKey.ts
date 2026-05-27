// Admin key recovery — the raw key is never stored on disk (only SHA-256 hash in DB).
// If lost, generate a new one.
// Usage: npx tsx src/utils/showAdminKey.ts [--regenerate]

import { initHistoryStore, getHistoryDb } from "../services/historyStore";
import { ensureUsersTable, regenerateApiKey } from "../services/userStore";
import { config } from "../core/config";

initHistoryStore();
ensureUsersTable();

const db = getHistoryDb();
const adminRow = db.prepare(
  "SELECT id, name, created_at FROM users WHERE permissions LIKE '%admin%' AND active = 1 ORDER BY created_at ASC LIMIT 1"
).get() as { id: string; name: string; created_at: string } | undefined;

if (!adminRow) {
  console.error("No admin user found. Start the server first.");
  process.exit(1);
}

const doRegenerate = process.argv.includes("--regenerate");

if (doRegenerate) {
  const result = regenerateApiKey(adminRow.id);
  if (!result) {
    console.error("Failed to regenerate key.");
    process.exit(1);
  }
  console.log("=".repeat(60));
  console.log("  NEW ADMIN API KEY — 仅显示一次，请立即保存！");
  console.log(`  ${result.apiKey}`);
  console.log("");
  console.log(`  Login: http://localhost:${config.PORT}/?key=${result.apiKey}`);
  console.log("=".repeat(60));
  process.exit(0);
}

console.log("Admin user found in database:");
console.log(`  Name: ${adminRow.name}`);
console.log(`  ID: ${adminRow.id}`);
console.log(`  Created: ${adminRow.created_at}`);
console.log("");
console.log("The API key is hashed (SHA-256) and never stored in plaintext on disk.");
console.log("If you lost the key, regenerate a new one:");
console.log("");
console.log("  npx tsx src/utils/showAdminKey.ts --regenerate");
console.log("");
console.log("Note: Old key will stop working after regeneration.");
process.exit(0);
