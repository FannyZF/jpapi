# API Reference

Base URL: `http://localhost:3000/api/v1`

All requests require `Content-Type: application/json` and `X-API-Key` header (except `/health` and webhook receiver).

## Table of Contents
- [Public Endpoints](#public-endpoints)
- [Classify](#hs-code-classification)
- [Cleanse](#data-cleansing)
- [Compliance](#compliance-check)
- [Admin](#admin-management)
- [Webhook](#webhook-receiver)
- [Settings & Statistics](#settings--statistics)
- [Rate Limiting & Errors](#rate-limiting--errors)

---

## Public Endpoints

### GET /health
Returns API status and available endpoints.

```
GET /api/v1/health
```

Response `200`:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "endpoints": {
    "classify": "POST /api/v1/classify",
    "compliance": "POST /api/v1/compliance/check",
    "address": "POST /api/v1/cleanse/address",
    "name": "POST /api/v1/cleanse/name",
    "item": "POST /api/v1/cleanse/item",
    "recipient": "POST /api/v1/cleanse/recipient"
  }
}
```

---

## HS Code Classification

### POST /classify

Classify a product description to HS code. Returns **immediate** results from local keyword matching (<500ms), then runs **async** dual-model LLM consensus (DeepSeek + QWen). Use `poll_id` to fetch LLM results, or configure webhook for server-side delivery.

```
POST /api/v1/classify
X-API-Key: <key>
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `raw_description` | string | Yes | Product description (CN/EN) |
| `hs_code` | string | No | For verification mode: proposed HS code to validate |

**Immediate Response `200`:**

```json
{
  "status": "success",
  "task_id": "uuid",
  "poll_id": "uuid",
  "mode": "poll",
  "cached": false,
  "structured_attributes": {
    "core_product_cn": "上衣 (Top/Blouse)",
    "core_product_en": "Top/Blouse",
    "material_cn": "100%棉 (100% Cotton)",
    "material_en": "100% Cotton",
    "function_cn": null,
    "function_en": null,
    "composition_cn": null,
    "composition_en": null,
    "processing_cn": null,
    "processing_en": null,
    "structure_cn": null,
    "structure_en": null,
    "technical_cn": null,
    "technical_en": null
  },
  "suggested_name_cn": "女装上衣纯棉",
  "suggested_name_en": "女装上衣纯棉",
  "tokens_used": 0,
  "extracted_keywords": ["上衣", "纯棉"],
  "candidates": [
    {
      "code": "61061000",
      "description": "Women's or girls' blouses, shirts and shirt-blouses, knitted or crocheted, of cotton",
      "description_cn": "棉制针织或钩编女衬衫",
      "confidence": 0.85,
      "matched_keywords": ["上衣", "纯棉"]
    }
  ],
  "best_guess": { "hs_code": "61061000", "description_en": "...", "confidence": 0.85 },
  "consensus": { "agreed": false, "primary_model": "local", "both_available": false }
}
```

### Poll LLM Results

```
GET /api/v1/classify/result/:poll_id
X-API-Key: <key>
```

Response:
- `{ "status": "pending" }` — LLM still running
- `{ "status": "ready", "data": { ... } }` — LLM completed with structured attributes, consensus, suggested names

### Webhook Mode

When a user has `webhook_enabled` and `webhook_url` configured (set via Admin panel), classify returns `"mode": "webhook"` and delivers the LLM result via HTTP POST to the user's webhook URL with HMAC-SHA256 signing.

---

## Data Cleansing

### POST /cleanse/address

Normalize address + zip code verification via ZipCloud (JP) or heuristic (non-JP).

```
POST /api/v1/cleanse/address
X-API-Key: <key>
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `raw_address` | string | Yes | Raw address |
| `provided_zipcode` | string | Yes | Postal code for verification |
| `order_id` | string | No | Reference ID |

Response `200`:
```json
{
  "status": "success",
  "reference_id": "REF123",
  "data": {
    "address": "東京都新宿区西新宿2-8-1",
    "zipcode": "160-0023"
  }
}
```

### POST /cleanse/name

Normalize recipient name (Kanji ↔ Furigana via Yahoo API, or heuristic).

```
POST /api/v1/cleanse/name
X-API-Key: <key>
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `raw_name` | string | Yes | Raw name |
| `order_id` | string | No | Reference ID |

Response `200`:
```json
{
  "status": "success",
  "reference_id": "REF123",
  "data": { "name": "山田 太郎" }
}
```

### POST /cleanse/item

Validate HS code against product description. Checks: prohibited/restricted goods, commercial quantity thresholds, CN trademark, JP drug/cosmetics laws, value limits.

```
POST /api/v1/cleanse/item
X-API-Key: <key>
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `raw_description` | string | Yes | Product description |
| `hs_code` | string | Yes | HS code to validate |
| `declared_value_jpy` | number | Yes | Declared value in JPY |
| `order_id` | string | No | Reference ID |

Response `200`:
```json
{
  "status": "success",
  "reference_id": "REF123",
  "data": {
    "item": {
      "hs_code": "84713000",
      "name": "Laptop Computer",
      "declared_value_jpy": 150000,
      "is_commercial": false,
      "potential_danger": false,
      "cn_trademark_risk": false
    },
    "compliance": {
      "passes": true,
      "issues": [],
      "warnings": []
    }
  }
}
```

### POST /cleanse/recipient

Batch cleanse: address + name + multiple items in one request.

```
POST /api/v1/cleanse/recipient
X-API-Key: <key>
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `recipient_info.raw_address` | string | Yes | Address |
| `recipient_info.provided_zipcode` | string | Yes | Zip code |
| `recipient_info.raw_name` | string | Yes | Name |
| `item_list` | array | Yes | Array of `{ item_id, raw_description, hs_code, declared_value_jpy }` |
| `order_id` | string | No | Reference ID |

Response `200`:
```json
{
  "status": "success",
  "reference_id": "REF123",
  "cleansed_data": {
    "name": "山田 太郎",
    "address": "東京都新宿区西新宿2-8-1",
    "zipcode": "160-0023",
    "items": [ ... ],
    "compliance_list": [ ... ]
  }
}
```

---

## Compliance Check

### POST /compliance/check

Check one or more items against all rules synchronously.

```
POST /api/v1/compliance/check
X-API-Key: <key>
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array | Yes | Array of `{ raw_description, hs_code, declared_value_jpy }` |

Response `200`:
```json
{
  "status": "success",
  "results": [
    {
      "raw_description": "Laptop",
      "hs_code": "84713000",
      "declared_value_jpy": 150000,
      "compliance": { "passes": true, "issues": [], "warnings": [] }
    }
  ]
}
```

---

## Admin Management

Requires `admin` permission.

### GET /users — List all users
```
GET /api/v1/users
```

### POST /users — Create user
```json
{ "name": "user", "permissions": ["classify","compliance"] }
```

### GET /users/:id — Get user details
```
GET /api/v1/users/uuid
```

### PUT /users/:id — Update user
```json
{ "name": "new-name", "active": true, "webhook_url": "https://example.com/hook", "webhook_enabled": true }
```

Response includes `webhook_secret` (auto-generated `whsec_` prefix) for HMAC signing.

### DELETE /users/:id — Disable user
```
DELETE /api/v1/users/uuid
```
Sets `active = 0`, does not hard-delete.

---

## Webhook Receiver

Built-in webhook testing endpoints (no auth required).

### POST /webhook/in/:userId/:token

```json
{ "task_id": "test", "status": "completed", "hs_code": "84145110" }
```

### GET /webhook/result/:token

Returns stored webhook data or `{ "status": "pending" }`.

---

## Settings & Statistics

### GET /settings — System settings (admin)
```
GET /api/v1/settings
```

### PUT /settings — Update settings (admin)
```json
{ "rate_limit_max": 100, "rate_limit_window_ms": 60000 }
```

### GET /statistics — Usage stats (admin)
```
GET /api/v1/statistics
```

### GET /billing — Token usage per user (admin)
```
GET /api/v1/billing
```

### GET /billing/:userId — Individual billing (admin)
```
GET /api/v1/billing/uuid
```

### GET /history — API call history
```
GET /api/v1/history?type=classify&limit=50
```

### GET /export — Export history as CSV
```
GET /api/v1/export?type=classify
```

---

## Rate Limiting & Errors

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (user) |
| 400 | Validation error (Zod) |
| 401 | Missing API key |
| 403 | Invalid key or insufficient permissions |
| 404 | Not found |
| 429 | Rate limit exceeded |
| 500 | Server error |

Rate limit header: `X-RateLimit-Remaining` / `X-RateLimit-Reset`.

---

## HS Codes

5,383 HS codes from Japan Customs Tariff Schedule (2024), stored in SQLite with synonym indexes. CN_MAP has 822 entries for keyword-based classification covering common consumer goods categories.
