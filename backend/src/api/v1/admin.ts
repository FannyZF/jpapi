import { Router, Request, Response } from "express";
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  regenerateApiKey,
  deleteUser,
  getAllPermissions,
  getMonthlyCallCounts,
} from "../../services/userStore";

const router = Router();

router.get("/users", (_req: Request, res: Response) => {
  try {
    const users = listUsers();
    const counts = getMonthlyCallCounts();
    const safeUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      permissions: u.permissions,
      active: u.active,
      created_at: u.created_at,
      last_used_at: u.last_used_at,
      webhook_url: u.webhook_url,
      webhook_secret: u.webhook_secret,
      webhook_enabled: u.webhook_enabled,
      company_name: u.company_name,
      contact_email: u.contact_email,
      contact_phone: u.contact_phone,
      countries: u.countries,
      monthly_calls: counts[u.id] || 0,
    }));
    res.json({ status: "success", users: safeUsers });
  } catch (err) {
    res.status(500).json({ status: "error", message: String(err) });
  }
});

router.get("/users/:id", (req: Request, res: Response) => {
  try {
    const user = getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ status: "error", message: "User not found" });
      return;
    }
    res.json({ status: "success", user });
  } catch (err) {
    res.status(500).json({ status: "error", message: String(err) });
  }
});

router.post("/users", (req: Request, res: Response) => {
  try {
    const { name, permissions } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ status: "error", message: "name is required" });
      return;
    }

    const validPerms = Array.isArray(permissions)
      ? permissions.filter((p: string) => getAllPermissions().includes(p))
      : [];

    const result = createUser(name.trim(), validPerms);

    res.status(201).json({
      status: "success",
      user: {
        id: result.user.id,
        name: result.user.name,
        api_key: result.apiKey,
        permissions: result.user.permissions,
        active: result.user.active,
        created_at: result.user.created_at,
      },
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: String(err) });
  }
});

router.put("/users/:id", (req: Request, res: Response) => {
  try {
    const { name, permissions, active, webhook_url, webhook_enabled, company_name, contact_email, contact_phone, countries } = req.body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (permissions !== undefined) {
      updates.permissions = Array.isArray(permissions)
        ? permissions.filter((p: string) => getAllPermissions().includes(p))
        : [];
    }
    if (active !== undefined) updates.active = active ? 1 : 0;
    if (webhook_url !== undefined) updates.webhook_url = webhook_url;
    if (webhook_enabled !== undefined) updates.webhook_enabled = webhook_enabled ? 1 : 0;
    if (company_name !== undefined) updates.company_name = company_name;
    if (contact_email !== undefined) updates.contact_email = contact_email;
    if (contact_phone !== undefined) updates.contact_phone = contact_phone;
    if (countries !== undefined) updates.countries = Array.isArray(countries) ? countries : ["jp"];

    const user = updateUser(
      req.params.id,
      updates as { name?: string; permissions?: string[]; active?: number; company_name?: string | null; contact_email?: string | null; contact_phone?: string | null }
    );

    if (!user) {
      res.status(404).json({ status: "error", message: "User not found" });
      return;
    }

    res.json({ status: "success", user });
  } catch (err) {
    res.status(500).json({ status: "error", message: String(err) });
  }
});

router.post("/users/:id/regenerate-key", (req: Request, res: Response) => {
  try {
    const result = regenerateApiKey(req.params.id);
    if (!result) {
      res.status(404).json({ status: "error", message: "User not found" });
      return;
    }

    res.json({
      status: "success",
      user: {
        id: result.user.id,
        name: result.user.name,
        api_key: result.apiKey,
        permissions: result.user.permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: String(err) });
  }
});

router.get("/permissions", (_req: Request, res: Response) => {
  res.json({ status: "success", permissions: getAllPermissions() });
});

router.delete("/users/:id", (req: Request, res: Response) => {
  try {
    const success = deleteUser(req.params.id);
    if (!success) {
      res.status(404).json({ status: "error", message: "User not found" });
      return;
    }
    res.json({ status: "success", message: "User deleted" });
  } catch (err) {
    res.status(500).json({ status: "error", message: String(err) });
  }
});

export default router;
