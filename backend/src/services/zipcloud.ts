import axios from "axios";
import { cacheGet, cacheSet } from "./cache";
import { zipCacheKey } from "../utils/hash";

const ZIPCLOUD_BASE = "http://zipcloud.ibsnet.co.jp/api/search";

export interface ZipCloudResult {
  prefecture: string;
  city: string;
  full_address: string;
  source?: "cache" | "live";
}

export async function fetchZipCloud(zipcode: string): Promise<ZipCloudResult | null> {
  const cacheKey = zipCacheKey(zipcode);
  const cached = await cacheGet<ZipCloudResult>(cacheKey);
  if (cached) return { ...cached, source: "cache" };

  try {
    const response = await axios.get(ZIPCLOUD_BASE, {
      params: { zipcode: zipcode.replace(/[\s\-]/g, "") },
      timeout: 10000,
    });

    const data = response.data;
    if (!data || !data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    const zipResult: ZipCloudResult = {
      prefecture: result.address1 || "",
      city: result.address2 || "",
      full_address: result.address3 || "",
    };

    await cacheSet(cacheKey, zipResult);
    return { ...zipResult, source: "live" };
  } catch {
    return null;
  }
}
