var http = require("http");
var fs = require("fs");
var db = require("better-sqlite3")("C:/Users/yueng/Desktop/API Hub/backend/data/cleanse_history.db");
var invoiceId = db.prepare("SELECT id FROM invoices ORDER BY generated_at DESC LIMIT 1").get().id;
db.close();

http.get("http://localhost:3000/api/v1/billing/invoice/" + invoiceId + "/csv", function(res) {
  var data = "";
  res.on("data", function(c) { data += c; });
  res.on("end", function() {
    fs.writeFileSync("C:/Users/yueng/Desktop/API Hub/backend/data/test_SF_Express.csv", data);
    var lines = data.split("\n");
    console.log("CSV header: " + lines[0]);
    console.log("Total lines: " + (lines.length - 1) + " (excluding header)");
    for (var i = 1; i <= Math.min(5, lines.length - 1); i++) {
      console.log("  " + lines[i]);
    }
    if (lines.length > 6) console.log("  ... (" + (lines.length - 6) + " more lines)");
  });
});
