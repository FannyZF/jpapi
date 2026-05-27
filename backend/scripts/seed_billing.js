const Database = require("better-sqlite3");
const crypto = require("crypto");

const db = new Database("C:/Users/yueng/Desktop/API Hub/backend/data/cleanse_history.db");
const userId = "f13bac46-70b5-4332-abeb-bb6d17dd4673";
const userName = "SF_Express";

const orders = [
  "SF001", "SF002", "SF003", "SF004", "SF005",
  "SF006", "SF007", "SF008", "SF009", "SF010",
];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - rand(1, daysBack));
  d.setHours(rand(8, 22), rand(0, 59), rand(0, 59));
  return d.toISOString();
}

const insert = db.prepare(
  "INSERT INTO api_call_logs (id, user_id, user_name, method, api_path, operation_type, status_code, processing_time_ms, ip_address, order_id, request_body, response_body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

const ops = [
  { type: "classify",  path: "/api/v1/classify",         count: 35, time: [20, 150] },
  { type: "address",   path: "/api/v1/cleanse/address",  count: 25, time: [10, 80]  },
  { type: "name",      path: "/api/v1/cleanse/name",     count: 15, time: [5, 50]   },
  { type: "item",      path: "/api/v1/cleanse/item",     count: 15, time: [10, 100] },
  { type: "compliance",path: "/api/v1/compliance/check", count: 10, time: [15, 90]  },
];

const allOps = [];
for (const op of ops) {
  for (let i = 0; i < op.count; i++) allOps.push(op);
}
for (let i = allOps.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [allOps[i], allOps[j]] = [allOps[j], allOps[i]];
}

const start = Date.now();
for (const op of allOps) {
  const orderId = orders[rand(0, orders.length - 1)];
  const status = Math.random() < 0.92 ? 200 : (Math.random() < 0.5 ? 400 : 500);
  const procTime = rand(op.time[0], op.time[1]);

  insert.run(
    crypto.randomUUID(), userId, userName, "POST", op.path, op.type,
    status, procTime, "192.168.1." + rand(1, 254),
    orderId,
    JSON.stringify({ raw_description: "mock item " + rand(1, 999), order_id: orderId }),
    JSON.stringify({ status: "success" }),
    randDate(3)
  );
}

console.log("Inserted 100 records in " + (Date.now() - start) + "ms");
db.close();
