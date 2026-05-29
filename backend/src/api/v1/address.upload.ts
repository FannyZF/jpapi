import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import * as XLSX from "xlsx";
import { cleanseAddress, splitAddressComponents } from "../../services/address.service";
import { fetchGoogleMaps } from "../../services/googleMaps";
import { fetchZipCloud } from "../../services/zipcloud";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const COLUMN_ALIASES: Record<string, string[]> = {
  prefecture: ["県", "prefecture", "都道府県", "pref", "ken", "todofuken"],
  city: ["市", "city", "市区", "city_name", "shi"],
  ward: ["区", "ward", "district", "町", "町域", "cho", "machi", "ku"],
  address: ["具体地址", "address", "住所", "番地", "detail", "street", "address_detail"],
  zipcode: ["邮编", "zip", "zipcode", "郵便番号", "postal_code", "postal"],
};

function findColumn(headers: string[], target: string[], fallback?: string): string | null {
  for (const h of headers) {
    const normalized = h.trim().toLowerCase();
    for (const alias of target) {
      if (normalized === alias.toLowerCase()) return h;
    }
  }
  if (fallback && headers.includes(fallback)) return fallback;
  return null;
}

function extractRoomNumberForUpload(address: string): { base: string; room: string; dashSegments: string[] } {
  const segments: string[] = [];

  // 1. Room suffix patterns
  const suffixPatterns = [
    /(\d+[号室階Ff])\s*$/,
    /([A-Za-z]?\d{2,4}[号室階Ff])\s*$/,
    /(\d+[‐\-–—ー]\d+[号室])\s*$/,
  ];
  for (const p of suffixPatterns) {
    const m = address.match(p);
    if (m) {
      segments.push(m[1]);
      return { base: address.slice(0, m.index).trim().replace(/[、,]\s*$/, ""), room: m[1], dashSegments: segments };
    }
  }

  // 2. Collect all dash-connected numbers as segments
  const dashNums = address.match(/\d+(?:[‐\-–—ー]\d+)*$/);
  if (dashNums) {
    const nums = dashNums[0].split(/[‐\-–—ー]/);
    segments.push(...nums);
  }
  const segCount = (address.match(/[‐\-–—ー]\d+/g) || []).length;

  if (segCount >= 2) {
    const lastDash = address.match(/[‐\-–—ー](\d+)$/);
    if (lastDash) {
      return { base: address.slice(0, lastDash.index).trim(), room: lastDash[1], dashSegments: segments };
    }
  }

  // 3. Trailing 3+ digit number
  const trailNum = address.match(/(\d{3,})\s*$/);
  if (trailNum) {
    segments.push(trailNum[1]);
    return { base: address.slice(0, trailNum.index).trim(), room: trailNum[1], dashSegments: segments };
  }

  return { base: address, room: "", dashSegments: segments };
}

// Upload: returns JSON with structured row data for review
router.post("/jp/cleanse/address/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ status: "error", message: "No file uploaded" });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length < 2) {
      res.status(400).json({ status: "error", message: "Excel must have at least a header row and one data row" });
      return;
    }

    const headers: string[] = data[0].map((h: any) => String(h || ""));
    const prefectureCol = (req.body.prefecture_col as string) || findColumn(headers, COLUMN_ALIASES.prefecture);
    const cityCol = (req.body.city_col as string) || findColumn(headers, COLUMN_ALIASES.city);
    const wardCol = (req.body.ward_col as string) || findColumn(headers, COLUMN_ALIASES.ward);
    const addressCol = (req.body.address_col as string) || findColumn(headers, COLUMN_ALIASES.address);
    const zipCol = (req.body.zip_col as string) || findColumn(headers, COLUMN_ALIASES.zipcode);

    const prefectureIdx = prefectureCol ? headers.indexOf(prefectureCol) : -1;
    const cityIdx = cityCol ? headers.indexOf(cityCol) : -1;
    const wardIdx = wardCol ? headers.indexOf(wardCol) : -1;
    const addressIdx = addressCol ? headers.indexOf(addressCol) : -1;
    const zipIdx = zipCol ? headers.indexOf(zipCol) : -1;

    if (addressIdx < 0 || zipIdx < 0) {
      res.status(400).json({ status: "error", message: "Could not identify address and zipcode columns." });
      return;
    }

    const rows: any[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const pref = prefectureIdx >= 0 ? String(row[prefectureIdx] || "") : "";
      const city = cityIdx >= 0 ? String(row[cityIdx] || "") : "";
      const ward = wardIdx >= 0 ? String(row[wardIdx] || "") : "";
      const addr = addressIdx >= 0 ? String(row[addressIdx] || "") : "";
      const zip = zipIdx >= 0 ? String(row[zipIdx] || "").replace(/[\s\-]/g, "") : "";
      const refId = crypto.randomUUID();

      if (!addr.trim() || !zip.trim()) {
        rows.push({ refId, pref, city, ward, addr, zip, status: "error", message: "Missing address/zipcode", dashSegments: [], fullAddr: "", validatedBase: "", validatedPref: "", validatedCity: "", validatedWard: "", validatedStreet: "", validatedZip: zip, validatedFull: "", validationLevel: "", correction: "" });
        continue;
      }

      const fullAddr = [pref, city, ward, addr].filter(Boolean).join(" ");
      const { base, room, dashSegments } = extractRoomNumberForUpload(fullAddr);

      try {
        const result = await cleanseAddress(refId, base, zip);
        const address = result.address;
        const components = (result as any).components || {};
        const fullJa = room ? (address.japanese_address + "-" + room) : address.japanese_address;
        const correctZip = result.zipcode?.match ? zip : (result.zipcode?.suggested_correct || zip);

        if (address.is_valid) {
          const split = splitAddressComponents(components, room || undefined);
          rows.push({
            refId, pref, city, ward, addr, zip,
            status: "verified",
            validationLevel: address.validation_level,
            message: address.verdict_message || "",
            dashSegments: dashSegments.length > 1 ? dashSegments : [],
            fullAddr,
            validatedBase: address.japanese_address,
            validatedPref: split?.prefecture || "",
            validatedCity: split?.city || "",
            validatedWard: split?.ward || "",
            validatedStreet: split?.street || "",
            validatedZip: correctZip,
            validatedFull: fullJa,
            correction: fullJa,
          });
        } else {
          // Blocked/OTHER: use ZipCloud for town name from zipcode
          let jaFull = fullAddr;
          let split: any = null;
          try {
            // Try Google Maps first with full address
            const fullResult = await fetchGoogleMaps(fullAddr, zip);
            if (fullResult) {
              jaFull = fullResult.address.japanese_address;
              split = splitAddressComponents(fullResult.components, room || undefined);
            }
          } catch { /* use original */ }

          // If OTHER (zip match but address unknown), use ZipCloud for town name
          if (address.validation_level === "OTHER" || !jaFull || jaFull === fullAddr) {
            try {
              const zipData = await fetchZipCloud(zip);
              if (zipData) {
                const townName = [zipData.prefecture, zipData.city, zipData.full_address].filter(Boolean).join("");
                if (townName) {
                  jaFull = townName;
                  split = { prefecture: zipData.prefecture, city: zipData.city, ward: "", street: zipData.full_address };
                }
              }
            } catch { /* keep existing */ }
          }

          rows.push({
            refId, pref, city, ward, addr, zip,
            status: address.validation_level === "OTHER" ? "review_other" : "blocked",
            validationLevel: address.validation_level,
            message: address.verdict_message || "Address not valid — 需人工核实",
            dashSegments,
            fullAddr,
            validatedBase: jaFull,
            validatedPref: split?.prefecture || pref,
            validatedCity: split?.city || city,
            validatedWard: split?.ward || ward,
            validatedStreet: split?.street || addr,
            validatedZip: zip,
            validatedFull: jaFull,
            correction: jaFull,
          });
        }
      } catch {
        rows.push({ refId, pref, city, ward, addr, zip, status: "error", message: "Processing error", dashSegments: [], fullAddr, validatedBase: "", validatedPref: "", validatedCity: "", validatedWard: "", validatedStreet: "", validatedZip: zip, validatedFull: "", validationLevel: "", correction: "" });
      }
    }

    res.json({ status: "success", rows, headers: { prefectureCol, cityCol, wardCol, addressCol, zipCol } });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Upload processing failed", details: String(err) });
  }
});

// Download: accept corrected rows, return Excel
const downloadSchema = { /* validated by body check */ };

router.post("/jp/cleanse/address/download", (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      res.status(400).json({ status: "error", message: "rows array required" });
      return;
    }

    const output: any[][] = [[
      "県（原始）", "市（原始）", "区（原始）", "具体地址（原始）", "邮编（原始）",
      "県（验证）", "市（验证）", "区（验证）", "具体地址（验证）", "验证后完整日文地址", "邮编（验证）",
      "验证状态", "验证精度", "提示信息", "参考编号",
    ]];

    for (const r of rows) {
      const statusLabel = r.status === "verified" ? "✓ VERIFIED" : "⚠ UNVERIFIED";
      output.push([
        r.pref || "", r.city || "", r.ward || "", r.addr || "", r.zip || "",
        r.validatedPref || "", r.validatedCity || "", r.validatedWard || "", r.validatedStreet || "",
        r.correction || r.validatedFull || "",
        r.validatedZip || "",
        statusLabel,
        r.validationLevel || "",
        r.message || "",
        r.refId || "",
      ]);
    }

    const outBook = XLSX.utils.book_new();
    const outSheet = XLSX.utils.aoa_to_sheet(output);
    XLSX.utils.book_append_sheet(outBook, outSheet, "Cleaned Addresses");
    const buf = XLSX.write(outBook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cleaned_addresses_${Date.now()}.xlsx"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ status: "error", message: "Download failed", details: String(err) });
  }
});

export default router;
