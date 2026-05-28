<template>
  <AppLayout>
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold">Billing</h1>
    </div>

    <div class="flex gap-2 mb-4">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        @click="activeTab = tab.key"
        class="px-4 py-2 rounded text-sm font-medium transition-colors"
        :class="activeTab === tab.key
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Generate Bill Tab -->
    <div v-if="activeTab === 'generate'" class="space-y-4">
      <div class="bg-white rounded-lg shadow border p-4">
        <h3 class="font-semibold mb-3">生成账单</h3>
        <div class="flex flex-wrap gap-3 items-end">
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500">用户</label>
            <select v-model="genForm.user_id" class="border rounded px-3 py-1.5 text-sm">
              <option value="">请选择用户</option>
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500">开始日期</label>
            <input v-model="genForm.start_date" type="date" class="border rounded px-3 py-1.5 text-sm" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500">结束日期</label>
            <input v-model="genForm.end_date" type="date" class="border rounded px-3 py-1.5 text-sm" />
          </div>
          <button
            @click="doGenerate"
            :disabled="generating"
            class="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {{ generating ? '生成中...' : '生成账单' }}
          </button>
        </div>
      </div>

      <div v-if="genResult" class="bg-white rounded-lg shadow border p-4">
        <h3 class="font-semibold mb-2">账单结果</h3>
        <div class="text-sm space-y-1 mb-3">
          <div>账单号: <span class="font-mono font-bold">{{ genResult.bill_number }}</span></div>
          <div>用户: {{ genResult.user_name }}</div>
          <div>客户: {{ genResult.company_name || '-' }}</div>
          <div>账期: {{ genResult.period_start }} ~ {{ genResult.period_end }}</div>
          <div class="text-lg font-bold text-blue-600">合计: ¥{{ genResult.total_amount.toFixed(2) }}</div>
        </div>

        <table class="w-full text-sm border mb-4">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left px-3 py-2">接口</th>
              <th class="text-right px-3 py-2">调用次数</th>
              <th class="text-right px-3 py-2">单价 (¥)</th>
              <th class="text-right px-3 py-2">费用 (¥)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, key) in genBreakdown" :key="key" class="border-t">
              <td class="px-3 py-2">{{ endpointNames[key] || key }}</td>
              <td class="text-right px-3 py-2">{{ item.calls }}</td>
              <td class="text-right px-3 py-2">{{ item.unit_price.toFixed(2) }}</td>
              <td class="text-right px-3 py-2 font-medium">{{ item.subtotal.toFixed(2) }}</td>
            </tr>
            <tr v-if="Object.keys(genBreakdown).length === 0" class="border-t">
              <td colspan="4" class="px-3 py-4 text-center text-gray-400">该时间段内无调用记录</td>
            </tr>
          </tbody>
        </table>

        <div class="flex gap-2">
          <a :href="getInvoicePdfUrl(genResult.id)" target="_blank"
             class="px-4 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm inline-block">
            Download PDF
          </a>
          <a :href="getInvoiceCsvUrl(genResult.id)" target="_blank"
             class="px-4 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm inline-block">
            Download CSV
          </a>
        </div>
      </div>
    </div>

    <!-- Past Invoices Tab -->
    <div v-if="activeTab === 'invoices'" class="space-y-4">
      <div class="bg-white rounded-lg shadow border p-4 flex flex-wrap gap-3 items-end">
        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-500">客户筛选</label>
          <select v-model="invFilter.user_id" @change="loadInvoices" class="border rounded px-3 py-1.5 text-sm">
            <option value="">全部客户</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2 ml-4">
          <span class="text-sm text-gray-500">未支付总额:</span>
          <span class="text-lg font-bold text-red-600">¥{{ unpaidTotal.toFixed(2) }}</span>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow border overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="text-left px-4 py-3">账单号</th>
              <th class="text-left px-4 py-3">用户</th>
              <th class="text-left px-4 py-3">客户</th>
              <th class="text-left px-4 py-3">账期</th>
              <th class="text-right px-4 py-3">金额</th>
              <th class="text-center px-4 py-3">状态</th>
              <th class="text-left px-4 py-3">生成时间</th>
              <th class="text-left px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="invoices.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-gray-400">暂无账单记录</td>
            </tr>
            <tr v-for="inv in invoices" :key="inv.id" class="border-b hover:bg-gray-50">
              <td class="px-4 py-3 font-mono text-xs">{{ inv.bill_number }}</td>
              <td class="px-4 py-3">{{ inv.user_name }}</td>
              <td class="px-4 py-3">{{ inv.company_name || '-' }}</td>
              <td class="px-4 py-3 text-xs">{{ inv.period_start }} ~ {{ inv.period_end }}</td>
              <td class="px-4 py-3 text-right font-bold text-blue-600">¥{{ inv.total_amount.toFixed(2) }}</td>
              <td class="px-4 py-3 text-center">
                <span :class="inv.paid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
                  class="px-2 py-0.5 rounded text-xs font-medium">
                  {{ inv.paid ? '已付款' : '未付款' }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-gray-500">{{ formatDate(inv.generated_at) }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-2 items-center">
                  <a :href="getInvoicePdfUrl(inv.id)" target="_blank" class="text-red-600 hover:underline text-xs">PDF</a>
                  <a :href="getInvoiceCsvUrl(inv.id)" target="_blank" class="text-green-600 hover:underline text-xs">CSV</a>
                  <button v-if="!inv.paid" @click="markPaid(inv.id)" class="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">已付款</button>
                  <button v-if="!inv.paid" @click="confirmReturn(inv)" class="px-2 py-0.5 text-xs bg-orange-500 text-white rounded hover:bg-orange-600">退回</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Summary Tab (existing) -->
    <div v-if="activeTab === 'summary'" class="space-y-4">
      <div class="bg-white rounded-lg shadow border p-4">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500">Period</label>
            <select v-model="filters.period" class="border rounded px-3 py-1.5 text-sm">
              <option value="monthly">Monthly</option>
              <option value="daily">Daily</option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500">Start Date</label>
            <input v-model="filters.start_date" type="date" class="border rounded px-3 py-1.5 text-sm" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500">End Date</label>
            <input v-model="filters.end_date" type="date" class="border rounded px-3 py-1.5 text-sm" />
          </div>
          <button @click="loadSummary" class="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Search</button>
          <button @click="exportCsv" class="px-4 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm">Export CSV</button>
        </div>
      </div>
      <div v-for="row in summary" :key="row.user_id + row.period" class="bg-white rounded-lg shadow border overflow-hidden">
        <div class="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
          <div>
            <span class="font-semibold">{{ row.user_name || 'Anonymous' }}</span>
            <span class="text-gray-500 ml-2 text-sm">{{ row.period }}</span>
          </div>
          <div class="flex gap-4 text-sm">
            <span class="text-gray-600">Total: <span class="font-bold text-blue-600">{{ row.total_calls }}</span> calls</span>
            <span class="text-gray-600">Avg: <span class="font-bold">{{ Math.round(row.avg_processing_time_ms) }}ms</span></span>
          </div>
        </div>
        <div class="px-4 py-3">
          <div class="flex flex-wrap gap-2">
            <span v-for="(count, opType) in row.by_operation" :key="opType"
              class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
              :class="operationBadge(opType)">{{ opType }} <span class="font-bold">{{ count }}</span>
            </span>
            <span v-if="Object.keys(row.by_operation).length === 0" class="text-gray-400 text-sm">No operations</span>
          </div>
        </div>
      </div>
      <p v-if="summary.length === 0" class="text-center text-gray-400 py-8">No billing data found</p>
    </div>

    <!-- Logs Tab (existing) -->
    <div v-if="activeTab === 'logs'" class="bg-white rounded-lg shadow border overflow-hidden">
      <div class="p-4 border-b flex flex-wrap gap-3 items-end bg-gray-50">
        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-500">User</label>
          <select v-model="logFilters.user_id" class="border rounded px-3 py-1.5 text-sm">
            <option value="">All</option>
            <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-500">Operation</label>
          <select v-model="logFilters.operation_type" class="border rounded px-3 py-1.5 text-sm">
            <option value="">All</option>
            <option v-for="(name, key) in endpointNames" :key="key" :value="key">{{ name }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-500">Start Date</label>
          <input v-model="logFilters.start_date" type="date" class="border rounded px-3 py-1.5 text-sm" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-sm text-gray-500">End Date</label>
          <input v-model="logFilters.end_date" type="date" class="border rounded px-3 py-1.5 text-sm" />
        </div>
        <button @click="searchLogs" class="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Search</button>
      </div>
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="text-left px-4 py-3">Time</th>
            <th class="text-left px-4 py-3">User</th>
            <th class="text-left px-4 py-3">Order ID</th>
            <th class="text-left px-4 py-3">Operation</th>
            <th class="text-left px-4 py-3">Status</th>
            <th class="text-left px-4 py-3">Time (ms)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="logs.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-gray-400">No log records found</td>
          </tr>
          <tr v-for="log in logs" :key="log.id" class="border-b hover:bg-gray-50">
            <td class="px-4 py-3 text-gray-500">{{ formatDate(log.created_at) }}</td>
            <td class="px-4 py-3">{{ log.user_name || '-' }}</td>
            <td class="px-4 py-3 font-mono text-xs">{{ log.order_id || '-' }}</td>
            <td class="px-4 py-3">
              <span v-if="log.operation_type" class="inline-block px-2 py-0.5 rounded text-xs font-medium" :class="operationBadge(log.operation_type)">{{ log.operation_type }}</span>
              <span v-else class="text-gray-400">-</span>
            </td>
            <td class="px-4 py-3">
              <span class="inline-block px-1.5 py-0.5 rounded text-xs font-medium" :class="statusBadge(log.status_code)">{{ log.status_code }}</span>
            </td>
            <td class="px-4 py-3">{{ log.processing_time_ms }}</td>
          </tr>
        </tbody>
      </table>
      <div class="flex justify-between items-center px-4 py-3 border-t bg-gray-50">
        <span class="text-sm text-gray-500">Page {{ logPage }} of {{ logTotalPages }} ({{ logTotal }} total)</span>
        <div class="flex gap-2">
          <button @click="goLogPage(logPage - 1)" :disabled="logPage <= 1"
            class="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-100">Prev</button>
          <button @click="goLogPage(logPage + 1)" :disabled="logPage >= logTotalPages"
            class="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-100">Next</button>
        </div>
      </div>
    </div>

    <p v-if="error" class="mt-4 text-red-500">{{ error }}</p>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import AppLayout from "../components/AppLayout.vue";
import {
  fetchBillingSummary, fetchBillingLogs, getBillingExportUrl,
  generateInvoice, fetchInvoices, payInvoice, returnInvoice, getInvoicePdfUrl, getInvoiceCsvUrl,
  type BillingSummaryRow, type BillingLogRecord, type InvoiceRecord, type InvoiceBreakdownItem,
} from "../api";
import api from "../api";

interface User { id: string; name: string; }

const tabs = [
  { key: "generate", label: "生成账单" },
  { key: "invoices", label: "历史账单" },
  { key: "summary", label: "汇总" },
  { key: "logs", label: "调用日志" },
];
const activeTab = ref("generate");

const users = ref<User[]>([]);
const summary = ref<BillingSummaryRow[]>([]);
const error = ref("");

const filters = reactive({
  period: "monthly" as "monthly" | "daily",
  start_date: "", end_date: "",
});

const logs = ref<BillingLogRecord[]>([]);
const logTotal = ref(0);
const logPage = ref(1);
const logTotalPages = ref(1);

const logFilters = reactive({
  user_id: "", operation_type: "", start_date: "", end_date: "",
});

const genForm = reactive({ user_id: "", start_date: "", end_date: "" });
const genResult = ref<InvoiceRecord | null>(null);
const generating = ref(false);
const invoices = ref<InvoiceRecord[]>([]);
const unpaidTotal = ref(0);
const invFilter = reactive({ user_id: "" });

const endpointNames: Record<string, string> = {
  address: "地址清洗", name: "姓名清洗",   item: "商品清洗",
  classify: "HS分类", compliance: "合规检查",
  history: "历史记录", cache: "缓存", export: "导出",
  statistics: "统计", settings: "设置", users: "用户管理",
  health: "健康检查", billing: "账单",
};

const genBreakdown = computed(() => {
  if (!genResult.value) return {};
  try {
    return JSON.parse(genResult.value.breakdown) as Record<string, InvoiceBreakdownItem>;
  } catch { return {}; }
});

function operationBadge(type: string) {
  const map: Record<string, string> = {
    address: "bg-blue-100 text-blue-700", name: "bg-purple-100 text-purple-700",
    item: "bg-yellow-100 text-yellow-700", recipient: "bg-green-100 text-green-700",
    classify: "bg-indigo-100 text-indigo-700", compliance: "bg-teal-100 text-teal-700",
    history: "bg-gray-100 text-gray-700", cache: "bg-orange-100 text-orange-700",
    export: "bg-cyan-100 text-cyan-700", statistics: "bg-pink-100 text-pink-700",
    settings: "bg-rose-100 text-rose-700", users: "bg-lime-100 text-lime-700",
    billing: "bg-amber-100 text-amber-700",
  };
  return map[type] || "bg-gray-100 text-gray-700";
}

function statusBadge(code: number) {
  if (code < 300) return "bg-green-100 text-green-700";
  if (code < 500) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function formatDate(iso: string) { return new Date(iso).toLocaleString(); }

async function loadUsers() {
  try { const r = await api.get("/users"); users.value = r.data.users || []; } catch { /* ignore */ }
}

async function loadSummary() {
  try {
    const params: Record<string, string> = { period: filters.period };
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    const res = await fetchBillingSummary(params);
    summary.value = res.data.summary;
  } catch { error.value = "Failed to load billing summary"; }
}

function buildLogParams() {
  const params: Record<string, string | number> = { page: logPage.value, limit: 30 };
  if (logFilters.user_id) params.user_id = logFilters.user_id;
  if (logFilters.operation_type) params.operation_type = logFilters.operation_type;
  if (logFilters.start_date) params.start_date = logFilters.start_date;
  if (logFilters.end_date) params.end_date = logFilters.end_date;
  return params;
}

async function searchLogs() {
  try {
    logPage.value = 1;
    const res = await fetchBillingLogs(buildLogParams());
    logs.value = res.data.records; logTotal.value = res.data.total; logTotalPages.value = res.data.totalPages;
  } catch { error.value = "Failed to load billing logs"; }
}

async function goLogPage(p: number) {
  logPage.value = p;
  const res = await fetchBillingLogs(buildLogParams());
  logs.value = res.data.records; logTotal.value = res.data.total; logTotalPages.value = res.data.totalPages;
}

function exportCsv() {
  const params: Record<string, string> = {};
  if (filters.start_date) params.start_date = filters.start_date;
  if (filters.end_date) params.end_date = filters.end_date;
  window.open(getBillingExportUrl(params), "_blank");
}

async function doGenerate() {
  if (!genForm.user_id || !genForm.start_date || !genForm.end_date) {
    error.value = "请选择用户和时间范围"; return;
  }
  generating.value = true;
  error.value = "";
  genResult.value = null;
  try {
    const res = await generateInvoice(genForm.user_id, genForm.start_date, genForm.end_date);
    genResult.value = res.data.invoice;
    error.value = res.data.duplicate ? "该客户该时间段已出具过账单，返回已有账单。" : "";
    await loadInvoices();
  } catch { error.value = "账单生成失败"; }
  generating.value = false;
}

async function loadInvoices() {
  try {
    const userId = invFilter.user_id || undefined;
    const r = await fetchInvoices(userId);
    invoices.value = r.data.invoices;
    unpaidTotal.value = r.data.unpaid_total || 0;
  } catch { /* ignore */ }
}

async function markPaid(invoiceId: string) {
  try {
    await payInvoice(invoiceId);
    await loadInvoices();
  } catch { error.value = "标记付款失败"; }
}

function confirmReturn(inv: InvoiceRecord) {
  if (!confirm(`退回账单 ${inv.bill_number}（¥${inv.total_amount.toFixed(2)}）？退回后可在"生成账单"中重新生成。`)) return;
  doReturn(inv.id);
}

async function doReturn(invoiceId: string) {
  try {
    await returnInvoice(invoiceId);
    await loadInvoices();
  } catch { error.value = "退回失败"; }
}

onMounted(() => {
  loadUsers();
  loadSummary();
  loadInvoices();
});
</script>
