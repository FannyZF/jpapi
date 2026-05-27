import rateLimit from "express-rate-limit";

export function createRateLimiter(
  windowMs: number,
  max: number,
  message: string
) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "error",
      message,
    },
  });
}
