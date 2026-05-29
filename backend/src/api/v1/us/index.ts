import { Router } from "express";
import usClassifyRouter from "./classify";
import usAddressRouter from "./address";
import usComplianceRouter from "./compliance";

const router = Router();
router.use(usClassifyRouter);
router.use(usAddressRouter);
router.use(usComplianceRouter);

export default router;
