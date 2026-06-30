import axios from "axios";
import { cacheGet, cacheSet, getCredential } from "./cache";
import { logger } from "../core/logger";

// 登录 Japan Post 后从 API リファレンス获取实际 endpoint
// 参考: https://org.biz.da.pf.japanpost.jp/
const TOKEN_URL = "https://org.biz.da.pf.japanpost.jp/oauth2/token";
const SEARCHCODE_URL = "https://org.biz.da.pf.japanpost.jp/api/v2/searchcode";
const ADDRESSZIP_URL = "https://org.biz.da.pf.japanpost.jp/api/v2/addresszip";

interface JapanPostToken {
  access_token: string;
  expires_at: number;
}

const TOKEN_CACHE_KEY = "japanpost:oauth_token";

async function getToken(): Promise<string | null> {
  const cached = await cacheGet<JapanPostToken>(TOKEN_CACHE_KEY);
  if (cached && cached.expires_at > Date.now() + 60000) {
    return cached.access_token;
  }

  const clientId = await getCredential("JAPANPOST_CLIENT_ID");
  const clientSecret = await getCredential("JAPANPOST_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    logger.warn("[JapanPost] Missing JAPANPOST_CLIENT_ID or JAPANPOST_CLIENT_SECRET");
    return null;
  }

  try {
    const res = await axios.post(TOKEN_URL, new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "searchcode addresszip",
    }).toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 10000,
    });

    const data = res.data;
    const expiresIn = data.expires_in || 3600;
    const token: JapanPostToken = {
      access_token: data.access_token,
      expires_at: Date.now() + expiresIn * 1000,
    };
    await cacheSet(TOKEN_CACHE_KEY, token);
    return token.access_token;
  } catch (err: any) {
    logger.error({ err: err?.response?.data || err?.message }, "[JapanPost] OAuth token fetch failed");
    return null;
  }
}

export interface JapanPostAddressResult {
  zipcode: string;
  prefecture: string;
  prefecture_kana: string;
  prefecture_romaji: string;
  city: string;
  city_kana: string;
  city_romaji: string;
  town: string;
  town_kana: string;
  town_romaji: string;
}

export interface JapanPostValidateResult {
  matched: boolean;
  input_zipcode: string;
  suggested_zipcode: string | null;
  address: JapanPostAddressResult | null;
  message: string;
}

/**
 * 通过邮编查询地址（校验邮编是否正确）
 */
export async function searchByZipcode(zipcode: string): Promise<JapanPostAddressResult | null> {
  const token = await getToken();
  if (!token) return null;

  const cleaned = zipcode.replace(/[^\d]/g, "");
  if (cleaned.length !== 7) return null;

  try {
    const res = await axios.get(SEARCHCODE_URL, {
      params: { zipcode: cleaned },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });

    const data = res.data;
    if (!data || (!data.results && !data.address)) return null;

    // 根据日本邮政 API 返回格式适配（需根据实际 API 参考文档调整字段名）
    const addr = data.address || data.results?.[0];
    if (!addr) return null;

    return {
      zipcode: cleaned,
      prefecture: addr.prefecture || addr.address1 || "",
      prefecture_kana: addr.prefectureKana || addr.prefecture_kana || "",
      prefecture_romaji: addr.prefectureRomaji || addr.prefecture_romaji || "",
      city: addr.city || addr.address2 || "",
      city_kana: addr.cityKana || addr.city_kana || "",
      city_romaji: addr.cityRomaji || addr.city_romaji || "",
      town: addr.town || addr.address3 || "",
      town_kana: addr.townKana || addr.town_kana || "",
      town_romaji: addr.townRomaji || addr.town_romaji || "",
    };
  } catch (err: any) {
    logger.error({ err: err?.response?.data || err?.message, zipcode }, "[JapanPost] searchcode failed");
    return null;
  }
}

/**
 * 通过地址查询邮编
 */
export async function searchByAddress(address: string): Promise<string | null> {
  const token = await getToken();
  if (!token) return null;

  try {
    const res = await axios.get(ADDRESSZIP_URL, {
      params: { address },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });

    const data = res.data;
    if (!data || !data.zipcode) return null;

    return data.zipcode || data.zip_code || data.postalCode || null;
  } catch (err: any) {
    logger.error({ err: err?.response?.data || err?.message, address }, "[JapanPost] addresszip failed");
    return null;
  }
}

/**
 * 完整校验：先根据邮编查地址，如果不匹配再用地址反查邮编
 */
export async function validateAddress(
  rawAddress: string,
  providedZipcode: string
): Promise<JapanPostValidateResult> {
  const cleanedZip = providedZipcode.replace(/[^\d]/g, "");

  // Step 1: 根据邮编查询官方地址
  const zipResult = await searchByZipcode(cleanedZip);

  if (!zipResult) {
    // 邮编无效，尝试根据地址反查邮编
    const suggested = await searchByAddress(rawAddress);
    return {
      matched: false,
      input_zipcode: providedZipcode,
      suggested_zipcode: suggested,
      address: null,
      message: suggested
        ? `郵便番号 ${providedZipcode} が無効です。正しい郵便番号: ${suggested}`
        : `郵便番号 ${providedZipcode} が無効です。正しい郵便番号が見つかりませんでした`,
    };
  }

  // Step 2: 比对地址是否匹配
  const officialAddr = [zipResult.prefecture, zipResult.city, zipResult.town]
    .filter(Boolean)
    .join("");
  const cleanedInput = rawAddress.replace(/[\s\u3000]/g, "");

  // 简单匹配：官方地址是否包含在用户输入中，或用户输入是否包含官方地址
  const matched =
    cleanedInput.includes(officialAddr) ||
    officialAddr.includes(cleanedInput) ||
    officialAddr.substring(0, Math.min(officialAddr.length - 2, cleanedInput.length)) ===
      cleanedInput.substring(0, Math.min(officialAddr.length - 2, cleanedInput.length));

  if (matched) {
    return {
      matched: true,
      input_zipcode: providedZipcode,
      suggested_zipcode: null,
      address: zipResult,
      message: "郵便番号と住所が一致しています",
    };
  }

  // 不匹配：用地址反查邮编
  const suggested = await searchByAddress(rawAddress);
  return {
    matched: false,
    input_zipcode: providedZipcode,
    suggested_zipcode: suggested,
    address: zipResult,
    message: suggested
      ? `郵便番号が住所と一致しません。正しい郵便番号: ${suggested}`
      : "郵便番号が住所と一致しません",
  };
}
