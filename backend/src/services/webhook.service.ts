import crypto from "crypto";
import { getHistoryDb } from "./historyStore";
import axios from "axios";

const RETRY_DELAYS = [10000, 30000, 60000];

function logWebhookDelivery(taskId: string, url: string, success: boolean, statusCode: number): void {
  try {
    const db = getHistoryDb();
    db.prepare(
      `INSERT INTO api_call_logs (id, user_id, user_name, method, api_path, operation_type, status_code, processing_time_ms, ip_address, order_id, request_body, response_body, deepseek_tokens, qwen_tokens, webhook_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(), null, null, "POST", url, "webhook_delivery", statusCode, 0, "", taskId,
      null, null, 0, 0, success ? "success" : "failed", new Date().toISOString()
    );
  } catch { /* ignore */ }
} // 10s, 30s, 60s

export function signPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return "sha256=" + hmac.digest("hex");
}

export async function deliverWebhook(
  url: string,
  secret: string,
  taskId: string,
  payload: object
): Promise<boolean> {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      await axios.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Task-Id": taskId,
        },
        timeout: 10000,
      });
      updateWebhookStatus(taskId, "success");
      logWebhookDelivery(taskId, url, true, 200);
      return true;
    } catch (e: any) {
      if (attempt < RETRY_DELAYS.length) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  updateWebhookStatus(taskId, "failed");
  logWebhookDelivery(taskId, url, false, 0);
  return false;
}

function updateWebhookStatus(taskId: string, status: string): void {
  try {
    const db = getHistoryDb();
    db.prepare(
      "UPDATE api_call_logs SET webhook_status = ?, response_body = substr(response_body || '', 1, 4000) || ? WHERE order_id = ?"
    ).run(status, ` | webhook:${status}`, taskId);
  } catch { /* ignore */ }
}
