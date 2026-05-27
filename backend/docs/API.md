# Japan Customs API Hub — 客户 API 接口文档

**版本**: 1.0  
**Base URL**: `http://your-server:port/api/v1`

---

## 通用说明

### 请求头 (Request Headers)

| Header | 必填 | 说明 |
|--------|------|------|
| `Content-Type` | 是 | `application/json` |
| `X-API-Key` | 是 | 由系统管理员分配的唯一 API 密钥，格式 `ch_xxxx...` |

### 通用响应字段

所有成功响应均包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `"success"` |
| `reference_id` | string | 本次请求的唯一标识，可用于追溯 |

### 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数校验失败，详见 `message` 和 `details` |
| 401 | 缺少 `X-API-Key` 请求头 |
| 403 | API Key 无效、已停用或无权访问该接口 |
| 429 | 请求频率超过限制 |
| 500 | 服务器内部错误 |

---

## 1. HS 编码分类 (Classify)

根据产品描述自动匹配最可能的 HS 编码。支持中英文输入，可选 HS 编码验证模式。

```
POST /api/v1/classify
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `raw_description` | string | 是 | 产品描述文本，支持中英文，建议包含品牌、材质、功能等关键信息。例如：`SHEIN牌女士纯棉上衣` |
| `hs_code` | string | 否 | 待验证的 HS 编码。提供后系统会判断该编码是否与描述匹配（验证模式） |

### 响应参数（立即返回）

系统立即返回本地关键词匹配结果，同时后台异步调用 AI 模型优化结果。

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `"success"` |
| `task_id` | string | 本次分类任务唯一标识 |
| `poll_id` | string | 轮询 ID，用于获取 AI 优化后的结果 |
| `mode` | string | `"poll"` (轮询模式) 或 `"webhook"` (Webhook 推送模式) |
| `extracted_keywords` | array[string] | 从描述中提取的关键词列表 |
| `suggested_name_cn` | string | 建议的中文品名 |
| `suggested_name_en` | string | 建议的英文品名 |
| `structured_attributes` | object | 7 维度产品属性结构化分析（见下表） |
| `candidates` | array | 候选 HS 编码列表（按置信度降序，最多 10 条） |
| `best_guess` | object\|null | 最佳匹配 HS 编码 |
| `consensus` | object | AI 双模型共识状态 |

### structured_attributes 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `core_product_cn` | string\|null | 核心产品类型（中文） |
| `core_product_en` | string\|null | 核心产品类型（英文） |
| `material_cn` | string\|null | 材质（中文） |
| `material_en` | string\|null | 材质（英文） |
| `function_cn` | string\|null | 功能用途（中文） |
| `function_en` | string\|null | 功能用途（英文） |
| `composition_cn` | string\|null | 成分（中文） |
| `composition_en` | string\|null | 成分（英文） |
| `processing_cn` | string\|null | 加工方式（中文） |
| `processing_en` | string\|null | 加工方式（英文） |
| `structure_cn` | string\|null | 结构形态（中文） |
| `structure_en` | string\|null | 结构形态（英文） |
| `technical_cn` | string\|null | 技术特征（中文） |
| `technical_en` | string\|null | 技术特征（英文） |

### best_guess 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `hs_code` | string | HS 编码，如 `61091000` |
| `description_en` | string | HS 编码英文描述 |
| `description_cn` | string | HS 编码中文描述 |
| `confidence` | number | 置信度，0~1，越高越可靠 |
| `matched_keywords` | array[string] | 匹配到的关键词 |

### candidates 数组元素

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | string | HS 编码 |
| `description` | string | HS 编码英文描述 |
| `description_cn` | string | HS 编码中文描述 |
| `confidence` | number | 置信度，0~1 |
| `matched_keywords` | array[string] | 匹配到的关键词 |

### consensus 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `agreed` | boolean | AI 模型是否达成共识 |
| `primary_model` | string | 主要参考模型：`"local"` / `"deepseek"` / `"qwen"` / `"dual"` |
| `both_available` | boolean | 两个 AI 模型是否均可用 |
| `deepseek_top_code` | string\|null | DeepSeek 模型推荐的首选编码 |
| `qwen_top_code` | string\|null | QWen 模型推荐的首选编码 |

### 轮询 AI 优化结果

```
GET /api/v1/classify/result/:poll_id
```

| 响应 status | 说明 |
|-------------|------|
| `"pending"` | AI 结果尚未就绪，请稍后重试 |
| `"ready"` | AI 结果已就绪，返回完整的分类数据（含更精准的 structured_attributes、consensus 等） |

### 示例

**请求**:
```json
{
  "raw_description": "SHEIN牌女士纯棉上衣",
  "hs_code": "61061000"
}
```

**响应**:
```json
{
  "status": "success",
  "task_id": "abc123",
  "poll_id": "abc123",
  "mode": "poll",
  "extracted_keywords": ["上衣", "纯棉", "cotton", "textile", "shirt", "blouse"],
  "suggested_name_cn": "女装上衣纯棉",
  "suggested_name_en": "Women's Cotton Blouse",
  "structured_attributes": {
    "core_product_cn": "上衣 (Top/Blouse)",
    "core_product_en": "Top/Blouse",
    "material_cn": "100%棉 (100% Cotton)",
    "material_en": "100% Cotton"
  },
  "candidates": [
    {
      "code": "61061000",
      "description": "Women's or girls' blouses... of cotton",
      "description_cn": "棉制针织或钩编女衬衫",
      "confidence": 0.85,
      "matched_keywords": ["cotton", "blouse"]
    }
  ],
  "best_guess": {
    "hs_code": "61061000",
    "description_en": "Women's or girls' blouses... of cotton",
    "description_cn": "棉制针织或钩编女衬衫",
    "confidence": 0.85,
    "matched_keywords": ["cotton", "blouse"]
  },
  "consensus": {
    "agreed": false,
    "primary_model": "local",
    "both_available": false,
    "deepseek_top_code": null,
    "qwen_top_code": null
  }
}
```

---

## 2. 地址清洗 (Address Cleanse)

标准化日本地址信息，校验邮编与地址匹配。

```
POST /api/v1/cleanse/address
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `order_id` | string | 否 | 订单号 / 业务参考编号，未提供时系统自动生成 |
| `raw_address` | string | 是 | 原始地址文本，支持日语、英语、中文 |
| `provided_zipcode` | string | 是 | 提供的邮编，如 `160-0023` |

### 响应参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `"success"` |
| `reference_id` | string | 请求唯一标识（订单号或系统生成） |
| `data.address.is_valid` | boolean | 地址是否有效 |
| `data.address.validation_level` | string | 验证精度：`PREMISE`（精确到门牌）、`STREET`（街道级）、`CITY`（城市级） |
| `data.address.japanese_address` | string | 标准化后的日文地址 |
| `data.address.english_address` | string | 标准化后的英文地址 |
| `data.zipcode.match` | boolean | 邮编与地址是否匹配 |
| `data.zipcode.provided` | string | 用户提供的邮编 |
| `data.zipcode.suggested_correct` | string\|null | 系统建议的正确邮编（不匹配时返回） |

### 示例

**请求**:
```json
{
  "order_id": "SF-2026-001",
  "raw_address": "160-0023 东京都新宿区西新宿2-8-1",
  "provided_zipcode": "160-0023"
}
```

**响应**:
```json
{
  "status": "success",
  "reference_id": "SF-2026-001",
  "data": {
    "address": {
      "is_valid": true,
      "validation_level": "PREMISE",
      "japanese_address": "東京都新宿区西新宿2丁目8-1",
      "english_address": "2-8-1 Nishishinjuku, Shinjuku City, Tokyo"
    },
    "zipcode": {
      "match": true,
      "provided": "1600023",
      "suggested_correct": null
    }
  }
}
```

---

## 3. 姓名清洗 (Name Cleanse)

收件人姓名标准化，支持日语汉字转片假名/罗马字。

```
POST /api/v1/cleanse/name
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `order_id` | string | 否 | 订单号 / 业务参考编号 |
| `raw_name` | string | 是 | 原始姓名，支持日语汉字、片假名、英文、中文 |

### 响应参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `"success"` |
| `reference_id` | string | 请求唯一标识 |
| `data.name.original` | string | 原始输入姓名 |
| `data.name.japanese_katakana` | string | 片假名转换结果（日语姓名时） |
| `data.name.english_romaji` | string | 罗马字转换结果 |

### 示例

**请求**:
```json
{
  "raw_name": "山田太郎"
}
```

**响应**:
```json
{
  "status": "success",
  "reference_id": "ref_20260527_a1b2c3d4",
  "data": {
    "name": {
      "original": "山田太郎",
      "japanese_katakana": "ヤマダタロウ",
      "english_romaji": "Yamada Taro"
    }
  }
}
```

---

## 4. 商品清洗 (Item Cleanse)

验证商品 HS 编码有效性和描述匹配度，同时进行合规检查（违禁品、限制品、价值评估等）。

```
POST /api/v1/cleanse/item
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `order_id` | string | 否 | 订单号 / 业务参考编号 |
| `raw_description` | string | 是 | 商品原始描述 |
| `hs_code` | string | 是 | 申报的 HS 编码 |
| `declared_value_jpy` | number | 是 | 申报价值（日元），必须 > 0 |

### 响应参数

### data.item 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `raw_description` | string | 原始描述 |
| `cleansed_description` | string | 清洗后的描述 |
| `hs_code` | string | 申报的 HS 编码 |
| `hs_code_valid` | boolean | HS 编码是否有效（存在于数据库中） |
| `hs_code_description` | string\|null | HS 编码对应的官方描述 |
| `declared_value_jpy` | number | 申报价值 |
| `value_assessment` | string | 价值评估：`normal` / `commercial_threshold`（超过商业件限额） |
| `suggested_description` | string\|null | 系统建议的修正描述（匹配度低时） |

### data.compliance 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `passed` | boolean | 是否通过合规检查 |
| `warnings` | array | 合规警告列表（见下方） |

### data.compliance.warnings 元素

| 字段 | 类型 | 说明 |
|------|------|------|
| `level` | string | 严重程度：`passed`（通过）、`warning`（警告）、`restricted`（限制品）、`blocked`（禁止品） |
| `check` | string | 检查项名称，如 `prohibited_goods`、`commercial_threshold`、`trademark_check` |
| `category` | string | 检查类别（如有） |
| `matched_keywords` | array[string] | 触发的关键词（如有） |
| `message` | string | 详细说明 |

### 示例

**请求**:
```json
{
  "order_id": "SF-2026-002",
  "raw_description": "Lithium Battery Pack 10000mAh",
  "hs_code": "85076000",
  "declared_value_jpy": 5000
}
```

**响应**:
```json
{
  "status": "success",
  "reference_id": "SF-2026-002",
  "data": {
    "item": {
      "raw_description": "Lithium Battery Pack 10000mAh",
      "cleansed_description": "Lithium Battery Pack 10000mAh",
      "hs_code": "85076000",
      "hs_code_valid": true,
      "hs_code_description": "Lithium-ion accumulators",
      "declared_value_jpy": 5000,
      "value_assessment": "normal",
      "suggested_description": null
    },
    "compliance": {
      "passed": false,
      "warnings": [
        {
          "level": "restricted",
          "check": "dangerous_goods",
          "category": "lithium_battery",
          "matched_keywords": ["lithium", "battery"],
          "message": "锂电池属于危险品，需符合 UN38.3 检测要求并提供 MSDS"
        }
      ]
    }
  }
}
```

---

## 5. 合规检查 (Compliance Check)

批量检查多个商品是否符合日本进口规定（违禁品、限制品、商业件阈值、品牌侵权风险等）。

```
POST /api/v1/compliance/check
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `items` | array | 是 | 待检查商品列表，至少 1 个 |

### items 元素

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `raw_description` | string | 是 | 商品描述 |
| `hs_code` | string | 是 | HS 编码 |
| `declared_value_jpy` | number | 是 | 申报价值（日元），必须 > 0 |

### 响应参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `"success"` |
| `results` | array | 每个商品的合规检查结果 |

### results 元素

| 字段 | 类型 | 说明 |
|------|------|------|
| `raw_description` | string | 商品描述 |
| `hs_code` | string | HS 编码 |
| `declared_value_jpy` | number | 申报价值 |
| `compliance.passed` | boolean | 是否通过 |
| `compliance.warnings` | array | 合规警告（同 item cleanse 的 warnings） |

### 示例

**请求**:
```json
{
  "items": [
    {
      "raw_description": "Cotton T-Shirt",
      "hs_code": "61091000",
      "declared_value_jpy": 3000
    },
    {
      "raw_description": "Fireworks Gift Box",
      "hs_code": "36041000",
      "declared_value_jpy": 8000
    }
  ]
}
```

**响应**:
```json
{
  "status": "success",
  "results": [
    {
      "raw_description": "Cotton T-Shirt",
      "hs_code": "61091000",
      "declared_value_jpy": 3000,
      "compliance": {
        "passed": true,
        "warnings": []
      }
    },
    {
      "raw_description": "Fireworks Gift Box",
      "hs_code": "36041000",
      "declared_value_jpy": 8000,
      "compliance": {
        "passed": false,
        "warnings": [
          {
            "level": "blocked",
            "check": "prohibited_goods",
            "matched_keywords": ["fireworks", "explosive"],
            "message": "烟花爆竹属于禁止进口物品"
          }
        ]
      }
    }
  ]
}
```

---

## 附录：完整的合规检查项

| 检查项 | 说明 | 可能的状态 |
|--------|------|------------|
| `prohibited_goods` | 日本禁止进口物品检查（武器、毒品、仿制品等） | `blocked` |
| `restricted_goods` | 限制进口物品检查（锂电池、药品、食品等） | `restricted` |
| `commercial_threshold` | 商业件价值阈值检查（超过一定金额需正式报关） | `warning` |
| `cn_trademark_risk` | 中国品牌在日本的商标侵权风险评估 | `warning` |
| `hs_code_mismatch` | HS 编码与描述匹配度检查 | `warning` |
| `jp_pharmaceutical` | 日本药事法合规检查（药品、化妆品等） | `restricted` |
| `jp_food_sanitation` | 日本食品卫生法检查 | `restricted` |
| `jp_electrical_safety` | 日本电气用品安全法（PSE）检查 | `restricted` |
| `value_assessment` | 价值合理性评估 | `warning` |
