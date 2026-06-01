// Duty rate estimation service
// Supports JP (Japan Customs) and US (USITC + Section 301) rates
// FX rates from Frankfurter API with 24h cache

import { getHistoryDb } from "./historyStore";
import axios from "axios";

const FRANKFURTER_URL = "https://api.frankfurter.app/latest";

interface FxRates {
  base: string;
  rates: Record<string, number>;
  updatedAt: number;
}

let fxCache: FxRates | null = null;
const FX_CACHE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Hardcoded fallback rates
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: { CNY: 7.25, JPY: 150.5, USD: 1 },
  CNY: { USD: 0.138, JPY: 20.8, CNY: 1 },
  JPY: { USD: 0.00664, CNY: 0.048, JPY: 1 },
};

export interface DutyRateRow {
  hscode: string;
  jp_mfn: number;
  us_mfn: number;
  us_301: number;
  description: string;
}

export interface DutyEstimate {
  rate: number;
  estimated_duty: number;
  currency: string;
  source_currency: string;
  exchange_rate: number;
  note: string;
}

export interface JpDutyEstimate extends DutyEstimate {
  consumption_tax: number;
  total_tax: number;
}

export interface UsDutyEstimate extends DutyEstimate {
  base_rate: number;
  section_301: number;
  total_rate: number;
  mpf: number;
  mpf_note: string;
  total_tax: number;
}

async function fetchFxRates(): Promise<FxRates | null> {
  try {
    const resp = await axios.get(FRANKFURTER_URL, {
      params: { base: "USD", symbols: "CNY,JPY" },
      timeout: 8000,
    });
    return {
      base: "USD",
      rates: resp.data.rates,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function getFxRates(): Promise<FxRates> {
  if (fxCache && (Date.now() - fxCache.updatedAt) < FX_CACHE_MS) return fxCache;
  const fresh = await fetchFxRates();
  if (fresh) { fxCache = fresh; return fresh; }
  // Fallback
  return { base: "USD", rates: { CNY: 7.25, JPY: 150.5 }, updatedAt: 0 };
}

function convert(to: string, from: string, amount: number, rates: Record<string, number>): number {
  if (to === from) return amount;
  const toUsd = FALLBACK_RATES[from]?.["USD"] ?? (1 / FALLBACK_RATES["USD"][from]);
  const usdAmount = amount * toUsd;
  if (to === "USD") return usdAmount;
  const rate = rates[to] || FALLBACK_RATES["USD"][to];
  return usdAmount * (rate || 1);
}

export function ensureDutyRatesTable(): void {
  const db = getHistoryDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS duty_rates (
      hscode TEXT PRIMARY KEY,
      jp_mfn REAL NOT NULL DEFAULT 0,
      us_mfn REAL NOT NULL DEFAULT 0,
      us_301 REAL NOT NULL DEFAULT 0,
      description TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    )
  `);
}

export async function importDutyCsv(): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  const csvPath = path.resolve(__dirname, "../../data/duty_rates.csv");
  if (!fs.existsSync(csvPath)) return;

  const db = getHistoryDb();
  const count = db.prepare("SELECT COUNT(*) as cnt FROM duty_rates").get() as { cnt: number };
  if (count.cnt > 0) return; // Already loaded

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.trim().split("\n");
  if (lines.length < 2) return;

  const insert = db.prepare(
    "INSERT OR REPLACE INTO duty_rates (hscode, jp_mfn, us_mfn, us_301, description, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const now = new Date().toISOString();

  db.transaction(() => {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(",");
      if (cols.length < 5) continue;
      insert.run(
        cols[0].trim(),
        parseFloat(cols[1]) || 0,
        parseFloat(cols[2]) || 0,
        parseFloat(cols[3]) || 0,
        cols[4]?.trim() || "",
        now,
      );
    }
  })();
}

function getDutyRate(hscode: string): DutyRateRow | null {
  const db = getHistoryDb();
  const code = hscode.replace(/[.\-\s]/g, "").substring(0, 6);
  if (code.length < 2) return null;

  // Try 6-digit, 4-digit, 2-digit
  for (const len of [6, 4, 2]) {
    const key = code.substring(0, len);
    const row = db.prepare("SELECT * FROM duty_rates WHERE hscode = ?").get(key) as DutyRateRow | undefined;
    if (row) return row;
  }
  return null;
}

export async function estimateJpDuty(
  hscode: string,
  salePrice: number,
  sourceCurrency: string
): Promise<JpDutyEstimate | null> {
  const row = getDutyRate(hscode);
  if (!row) return null;

  const fx = await getFxRates();
  const priceJpy = convert("JPY", sourceCurrency.toUpperCase(), salePrice, fx.rates);
  const rate = row.jp_mfn;
  const duty = Math.round(priceJpy * rate * 100) / 100;
  const consumption = Math.round((priceJpy + duty) * 0.10 * 100) / 100;
  const total = Math.round((duty + consumption) * 100) / 100;
  const exchangeRate = Math.round(convert("JPY", sourceCurrency.toUpperCase(), 1, fx.rates) * 10000) / 10000;

  return {
    rate,
    estimated_duty: duty,
    consumption_tax: consumption,
    total_tax: total,
    currency: "JPY",
    source_currency: sourceCurrency.toUpperCase(),
    exchange_rate: exchangeRate,
    note: "6位HS级估算，仅供参考，实际以日本海关核定为准",
  };
}

export async function estimateUsDuty(
  hscode: string,
  salePrice: number,
  sourceCurrency: string
): Promise<UsDutyEstimate | null> {
  const row = getDutyRate(hscode);
  if (!row) return null;

  const fx = await getFxRates();
  const priceUsd = Math.max(1, convert("USD", sourceCurrency.toUpperCase(), salePrice, fx.rates));
  const baseRate = row.us_mfn;
  const s301 = row.us_301;
  const totalRate = Math.round((baseRate + s301) * 10000) / 10000;
  const dutyVal = Math.round(priceUsd * (baseRate + s301) * 100) / 100;
  const mpf = Math.max(29.66, Math.round(priceUsd * 0.003464 * 100) / 100);
  const total = Math.round(dutyVal * 100) / 100;
  const exchangeRate = Math.round(convert("USD", sourceCurrency.toUpperCase(), 1, fx.rates) * 10000) / 10000;

  return {
    rate: dutyVal,
    estimated_duty: dutyVal,
    base_rate: baseRate,
    section_301: s301,
    total_rate: totalRate,
    mpf: Math.round(mpf * 100) / 100,
    mpf_note: "MPF is per customs entry: 0.3464% of entered value, min $29.66, max $575.35 per entry",
    total_tax: total,
    currency: "USD",
    source_currency: sourceCurrency.toUpperCase(),
    exchange_rate: exchangeRate,
    note: "6位HS级估算，仅供参考，实际以CBP核定为准",
  };
}
