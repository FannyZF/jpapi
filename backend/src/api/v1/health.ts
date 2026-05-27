import { Router, Request, Response } from "express";

const router = Router();

router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Japan Customs API Hub",
    version: "1.0.0",
    endpoints: {
      address: "POST /api/v1/cleanse/address",
      name: "POST /api/v1/cleanse/name",
      item: "POST /api/v1/cleanse/item",
    },
  });
});

export default router;
