import crypto from "crypto";

export function generateReferenceId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(4).toString("hex");
  return `ref_${date}_${random}`;
}
