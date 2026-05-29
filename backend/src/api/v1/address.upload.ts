import { Router, Request, Response } from "express";
import multer from "multer";
import crypto from "crypto";
import * as XLSX from "xlsx";
import { cleanseAddress, splitAddressComponents } from "../../services/address.service";
import { fetchGoogleMaps } from "../../services/googleMaps";

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

    // Auto-detect or use provided column names
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
      res.status(400).json({ status: "error", message: "Could not identify address and zipcode columns. Specify address_col and zip_col." });
      return;
    }

    // Output header
    const output: any[][] = [[
      "県（原始）", "市（原始）", "区（原始）", "具体地址（原始）", "邮编（原始）",
      "県（验证）", "市（验证）", "区（验证）", "具体地址（验证）", "验证后完整日文地址", "邮编（验证）",
      "验证状态", "验证精度", "提示信息", "参考编号",
    ]];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const pref = prefectureIdx >= 0 ? String(row[prefectureIdx] || "") : "";
      const city = cityIdx >= 0 ? String(row[cityIdx] || "") : "";
      const ward = wardIdx >= 0 ? String(row[wardIdx] || "") : "";
      const addr = addressIdx >= 0 ? String(row[addressIdx] || "") : "";
      const zip = zipIdx >= 0 ? String(row[zipIdx] || "").replace(/[\s\-]/g, "") : "";

      if (!addr.trim() || !zip.trim()) {
        output.push([pref, city, ward, addr, zip, "", "", "", "", "", "⚠ UNVERIFIED", "", "Missing address/zipcode", crypto.randomUUID()]);
        continue;
      }

      const fullAddr = [pref, city, ward, addr].filter(Boolean).join(" ");
      const { base, room } = extractRoomNumberForUpload(fullAddr);
      const refId = crypto.randomUUID();

      try {
        const result = await cleanseAddress(refId, base, zip);
        const address = result.address;
        const components = (result as any).components || {};
        const fullJaAddress = room ? (address.japanese_address + "-" + room) : address.japanese_address;

        if (address.is_valid) {
          const split = splitAddressComponents(components, room || undefined);
          const correctZip = result.zipcode?.match ? zip : (result.zipcode?.suggested_correct || zip);
          output.push([
            pref, city, ward, addr, zip,
            split?.prefecture || "", split?.city || "", split?.ward || "", split?.street || "",
            fullJaAddress,
            correctZip,
            "✓ VERIFIED",
            address.validation_level,
            address.verdict_message || "",
            refId,
          ]);
        } else {
          // Unverified: try full address for Japanese translation + split
          let jaFull = fullAddr;
          let split: { prefecture: string; city: string; ward: string; street: string } | null = null;
          try {
            const fullResult = await fetchGoogleMaps(fullAddr, zip);
            if (fullResult) {
              jaFull = fullResult.address.japanese_address;
              split = splitAddressComponents(fullResult.components, room || undefined);
            }
          } catch { /* use original */ }
          output.push([pref, city, ward, addr, zip,
            split?.prefecture || pref,
            split?.city || city,
            split?.ward || ward,
            split?.street || addr,
            jaFull,
            zip,
            "⚠ UNVERIFIED",
            address.validation_level,
            address.verdict_message || "Address not valid — 需人工核实",
            refId,
          ]);
        }
      } catch {
        output.push([pref, city, ward, addr, zip, pref, city, ward, addr, fullAddr, zip, "⚠ UNVERIFIED", "", "Processing error", refId]);
      }
    }

    const outBook = XLSX.utils.book_new();
    const outSheet = XLSX.utils.aoa_to_sheet(output);
    XLSX.utils.book_append_sheet(outBook, outSheet, "Cleaned Addresses");

    const buf = XLSX.write(outBook, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cleaned_addresses_${Date.now()}.xlsx"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ status: "error", message: "Upload processing failed", details: String(err) });
  }
});

function extractRoomNumberForUpload(address: string): { base: string; room: string } {
  // 1. Room suffix patterns (号室/F/階 etc.)
  const suffixPatterns = [
    /(\d+[号室階Ff])\s*$/,
    /([A-Za-z]?\d{2,4}[号室階Ff])\s*$/,
    /(\d+[‐\-–—ー]\d+[号室])\s*$/,
  ];
  for (const p of suffixPatterns) {
    const m = address.match(p);
    if (m) return { base: address.slice(0, m.index).trim().replace(/[、,]\s*$/, ""), room: m[1] };
  }

  // 2. Trailing dash-number: always strip last segment for any dash-connected numbers
  // Google Maps doesn't validate to building (号) level, so we strip+reattach to preserve
  const lastDash = address.match(/(\d+[‐\-–—ー])+(\d+)$/);
  if (lastDash) {
    const base = address.slice(0, lastDash.index).trim().replace(/[‐\-–—ー]\s*$/, "");
    return { base, room: lastDash[2] };
  }

  // 3. Trailing isolated number (3+ digits, likely room/apartment)
  const trailNum = address.match(/(\d{3,})\s*$/);
  if (trailNum) {
    const base = address.slice(0, trailNum.index).trim();
    return { base, room: trailNum[1] };
  }

  return { base: address, room: "" };
}

export default router;
