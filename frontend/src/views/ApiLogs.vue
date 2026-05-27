<template>
  <AppLayout>
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl font-bold">API Call Logs</h1>
      <div class="flex gap-2 items-center">
        <label class="flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" v-model="autoRefresh" class="rounded" />
          Auto-refresh (10s)
        </label>
        <button @click="loadLogs" class="px-3 py-1 text-sm border rounded hover:bg-gray-100">Refresh</button>
      </div>
    </div>

    <!-- Stats bar -->
    <div class="grid grid-cols-5 gap-3 mb-4">
      <div class="bg-white rounded shadow border p-3 text-center">
        <div class="text-2xl font-bold text-blue-600">{{ logTotal }}</div>
        <div class="text-xs text-gray-500">Total Calls</div>
      </div>
      <div class="bg-white rounded shadow border p-3 text-center">
        <div class="text-2xl font-bold text-green-600">{{ stats.ok }}</div>
        <div class="text-xs text-gray-500">200 OK</div>
      </div>
      <div class="bg-white rounded shadow border p-3 text-center">
        <div class="text-2xl font-bold text-yellow-600">{{ stats.err4 }}</div>
        <div class="text-xs text-gray-500">4xx Errors</div>
      </div>
      <div class="bg-white rounded shadow border p-3 text-center">
        <div class="text-2xl font-bold text-red-600">{{ stats.err5 }}</div>
        <div class="text-xs text-gray-500">5xx Errors</div>
      </div>
      <div class="bg-white rounded shadow border p-3 text-center">
        <div class="text-2xl font-bold text-gray-600">{{ stats.avgMs }}ms</div>
        <div class="text-xs text-gray-500">Avg Latency</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow border p-3 mb-4">
      <div class="flex flex-wrap gap-2 items-end">
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500">Operation</label>
          <select v-model="filters.operation_type" class="border rounded px-2 py-1 text-xs w-28">
            <option value="">All</option>
            <option value="address">Address</option>
            <option value="name">Name</option>
            <option value="item">Item</option>
            <option value="history">History</option>
            <option value="cache">Cache</option>
            <option value="export">Export</option>
            <option value="billing">Billing</option>
            <option value="statistics">Stats</option>
            <option value="settings">Settings</option>
            <option value="users">Users</option>
            <option value="classify">Classify</option>
            <option value="compliance">Compliance</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500">Status</label>
          <select v-model="filters.status_code" class="border rounded px-2 py-1 text-xs w-20">
            <option value="">All</option>
            <option value="200">200</option>
            <option value="201">201</option>
            <option value="400">400</option>
            <option value="401">401</option>
            <option value="403">403</option>
            <option value="404">404</option>
            <option value="429">429</option>
            <option value="500">500</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500">Method</label>
          <select v-model="filters.method" class="border rounded px-2 py-1 text-xs w-16">
            <option value="">All</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500">Start</label>
          <input v-model="filters.start_date" type="date" class="border rounded px-2 py-1 text-xs" />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-xs text-gray-500">End</label>
          <input v-model="filters.end_date" type="date" class="border rounded px-2 py-1 text-xs" />
        </div>
        <button @click="searchLogs" class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Search</button>
      </div>
    </div>

    <!-- Log table -->
    <div class="bg-white rounded-lg shadow border overflow-hidden">
      <table class="w-full text-xs">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="text-left px-3 py-2 w-36">Time</th>
            <th class="text-left px-3 py-2">User</th>
            <th class="text-left px-3 py-2 w-14">Method</th>
            <th class="text-left px-3 py-2">Path</th>
            <th class="text-left px-3 py-2 w-20">Status</th>
            <th class="text-left px-3 py-2 w-16">Time</th>
            <th class="text-left px-3 py-2 w-36">IP</th>
            <th class="text-left px-3 py-2 w-8"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="logs.length === 0">
            <td colspan="8" class="px-3 py-6 text-center text-gray-400">No API calls recorded yet</td>
          </tr>
          <template v-for="log in logs" :key="log.id">
            <tr class="border-b hover:bg-gray-50 cursor-pointer" @click="toggleExpand(log.id)">
              <td class="px-3 py-1.5 text-gray-500 font-mono">{{ fmtTime(log.created_at) }}</td>
              <td class="px-3 py-1.5">{{ log.user_name || '—' }}</td>
              <td class="px-3 py-1.5">
                <span class="inline-block px-1 py-0 rounded text-xs font-mono font-medium"
                  :class="methodClass(log.method)">{{ log.method }}</span>
              </td>
              <td class="px-3 py-1.5 font-mono text-gray-600 truncate max-w-xs block">{{ log.api_path }}</td>
              <td class="px-3 py-1.5">
                <span class="inline-block px-1 py-0 rounded text-xs font-medium"
                  :class="statusClass(log.status_code)">{{ log.status_code }}</span>
              </td>
              <td class="px-3 py-1.5 text-gray-500">{{ log.processing_time_ms }}ms</td>
              <td class="px-3 py-1.5 font-mono text-gray-400">{{ log.ip_address }}</td>
              <td class="px-1 py-1.5 text-gray-400 text-xs">{{ expandedId === log.id ? '−' : '+' }}</td>
            </tr>
            <tr v-if="expandedId === log.id" class="bg-gray-50 border-b">
              <td colspan="8" class="px-3 py-2">
                <div class="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div class="font-medium text-gray-500 mb-1">Request Body:</div>
                    <pre class="bg-gray-100 p-2 rounded max-h-40 overflow-auto text-xs">{{ log.request_body || '(empty)' }}</pre>
                  </div>
                  <div>
                    <div class="font-medium text-gray-500 mb-1">Response Body:</div>
                    <pre class="bg-gray-100 p-2 rounded max-h-40 overflow-auto text-xs">{{ log.response_body || '(empty)' }}</pre>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div class="flex justify-between items-center px-3 py-2 border-t bg-gray-50">
        <span class="text-xs text-gray-500">Page {{ logPage }} / {{ logTotalPages }} ({{ logTotal }} total)</span>
        <div class="flex gap-1">
          <button @click="goPage(logPage - 1)" :disabled="logPage <= 1"
            class="px-2 py-1 border rounded text-xs disabled:opacity-50 hover:bg-gray-100">Prev</button>
          <button @click="goPage(logPage + 1)" :disabled="logPage >= logTotalPages"
            class="px-2 py-1 border rounded text-xs disabled:opacity-50 hover:bg-gray-100">Next</button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from "vue";
import AppLayout from "../components/AppLayout.vue";
import api, { type BillingLogRecord } from "../api";

const logs = ref<BillingLogRecord[]>([]);
const logTotal = ref(0);
const logPage = ref(1);
const logTotalPages = ref(1);
const autoRefresh = ref(true);
const expandedId = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | null = null;

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

const filters = reactive({
  operation_type: "",
  status_code: "",
  method: "",
  start_date: "",
  end_date: "",
});

const stats = computed(() => {
  const ok = logs.value.filter(l => l.status_code >= 200 && l.status_code < 300).length;
  const err4 = logs.value.filter(l => l.status_code >= 400 && l.status_code < 500).length;
  const err5 = logs.value.filter(l => l.status_code >= 500).length;
  const avg = logs.value.length > 0
    ? Math.round(logs.value.reduce((s, l) => s + l.processing_time_ms, 0) / logs.value.length)
    : 0;
  return { ok, err4, err5, avgMs: avg };
});

function fmtTime(iso: string) { return new Date(iso).toLocaleString(); }

function methodClass(m: string) {
  const map: Record<string, string> = { GET: "bg-green-100 text-green-700", POST: "bg-blue-100 text-blue-700", PUT: "bg-yellow-100 text-yellow-700", DELETE: "bg-red-100 text-red-700" };
  return map[m] || "bg-gray-100 text-gray-600";
}

function statusClass(c: number) {
  if (c < 300) return "bg-green-100 text-green-700";
  if (c < 400) return "bg-blue-100 text-blue-700";
  if (c < 500) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

async function loadLogs() {
  try {
    const params: Record<string, string | number> = { page: logPage.value, limit: 50 };
    if (filters.operation_type) params.operation_type = filters.operation_type;
    if (filters.status_code) params.status_code = filters.status_code;
    if (filters.method) params.method = filters.method;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;

    const res = await api.get("/billing/logs", { params });
    logs.value = res.data.records;
    logTotal.value = res.data.total;
    logTotalPages.value = res.data.totalPages;
  } catch { /* ignore */ }
}

async function searchLogs() { logPage.value = 1; await loadLogs(); }
async function goPage(p: number) { logPage.value = p; await loadLogs(); }

onMounted(() => {
  loadLogs();
  timer = setInterval(() => { if (autoRefresh.value) loadLogs(); }, 10000);
});

onUnmounted(() => { if (timer) clearInterval(timer); });
</script>
