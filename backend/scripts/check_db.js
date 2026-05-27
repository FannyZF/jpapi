var db = require("better-sqlite3")("C:/Users/yueng/Desktop/API Hub/backend/data/cleanse_history.db");
var tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log("Tables:", tables.map(function(t) { return t.name; }).join(", "));
var users = db.prepare("SELECT id, name FROM users").all();
users.forEach(function(u) { console.log("User:", u.name, "(" + u.id + ")"); });
db.close();
