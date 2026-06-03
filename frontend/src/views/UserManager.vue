<template>
  <AppLayout>
    <h1 class="text-2xl font-bold mb-6">User Management</h1>

    <div class="bg-white rounded-lg shadow border p-4 mb-6">
      <button
        @click="showCreate = true"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
      >
        + Create User
      </button>
    </div>

    <div class="bg-white rounded-lg shadow border overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b">
          <tr>
            <th class="text-left px-4 py-3">Name</th>
            <th class="text-left px-4 py-3">Company</th>
            <th class="text-left px-4 py-3">API Key</th>
            <th class="text-left px-4 py-3">Permissions</th>
            <th class="text-left px-4 py-3">Monthly Calls</th>
            <th class="text-left px-4 py-3">Status</th>
            <th class="text-left px-4 py-3">Created</th>
            <th class="text-left px-4 py-3">Last Used</th>
            <th class="text-left px-4 py-3 w-16">Webhook</th>
            <th class="text-left px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0">
            <td colspan="8" class="px-4 py-8 text-center text-gray-400">No users</td>
          </tr>
          <tr v-for="u in users" :key="u.id" class="border-b hover:bg-gray-50">
            <td class="px-4 py-3 font-medium">{{ u.name }}</td>
            <td class="px-4 py-3 text-xs">{{ u.company_name || '-' }}</td>
            <td class="px-4 py-3 font-mono text-xs">{{ u.api_key || '••••••••' }}</td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="p in u.permissions"
                  :key="p"
                  class="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs"
                >{{ p }}</span>
                <span v-if="u.permissions.length === 0" class="text-gray-400 text-xs">none</span>
              </div>
            </td>
            <td class="px-4 py-3 text-center">
              <span class="font-mono font-bold text-sm">{{ u.monthly_calls || 0 }}</span>
            </td>
            <td class="px-4 py-3">
              <span :class="u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'" class="px-2 py-0.5 rounded text-xs">
                {{ u.active ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-500 text-xs">{{ formatDate(u.created_at) }}</td>
            <td class="px-4 py-3 text-gray-500 text-xs">{{ u.last_used_at ? formatDate(u.last_used_at) : '-' }}</td>
            <td class="px-4 py-3">
              <span v-if="u.webhook_enabled" class="text-green-600 text-xs" title="Webhook enabled">✓</span>
              <span v-else class="text-gray-300 text-xs">—</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex gap-2">
                <button @click="editUser(u)" class="text-blue-600 hover:underline text-xs">Edit</button>
                <button @click="confirmRegenerate(u)" class="text-orange-600 hover:underline text-xs">New Key</button>
                <button @click="confirmToggle(u)" class="text-xs" :class="u.active ? 'text-red-600 hover:underline' : 'text-green-600 hover:underline'">
                  {{ u.active ? 'Deactivate' : 'Activate' }}
                </button>
                <button @click="confirmDelete(u)" class="text-red-600 hover:underline text-xs">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Modal -->
    <div v-if="showCreate" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-lg p-6 w-96">
        <h3 class="text-lg font-semibold mb-4">Create User</h3>
        <div class="space-y-3">
          <div>
            <label class="text-sm text-gray-500">Name</label>
            <input v-model="form.name" type="text" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="Client name" />
          </div>
          <div>
            <label class="text-sm text-gray-500">Permissions</label>
            <div class="flex flex-wrap gap-2 mt-1">
              <label v-for="p in allPerms" :key="p" class="flex items-center gap-1 text-sm">
                <input type="checkbox" :value="p" v-model="form.permissions" />
                {{ p }}
              </label>
          </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-4">
          <button @click="showCreate = false" class="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
          <button @click="doCreate" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div v-if="showEdit" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-lg p-6 w-96">
        <h3 class="text-lg font-semibold mb-4">Edit User</h3>
        <div class="space-y-3">
          <div>
            <label class="text-sm text-gray-500">Name</label>
            <input v-model="editForm.name" type="text" class="w-full border rounded px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label class="text-sm text-gray-500">Permissions</label>
            <div class="flex flex-wrap gap-2 mt-1">
              <label v-for="p in allPerms" :key="p" class="flex items-center gap-1 text-sm">
                <input type="checkbox" :value="p" v-model="editForm.permissions" />
                {{ p }}
              </label>
            </div>
          </div>
          <div>
            <label class="text-sm text-gray-500">Webhook URL (客户的接收地址)</label>
            <input v-model="editForm.webhook_url" type="text" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="https://customer-api.com/webhook" />
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" v-model="editForm.webhook_enabled" />
            <label class="text-sm text-gray-500">Enable Webhook</label>
          </div>
          <div class="bg-gray-50 border rounded p-2 text-xs text-gray-500">
            <span class="font-medium">Webhook 签名密钥 </span>
            <code class="bg-gray-200 px-1 rounded select-all">{{ editForm.webhook_secret || '(自动生成，创建用户时分配)' }}</code>
            <p class="mt-1">将此密钥交给客户，用于验证 webhook 推送的 <code>X-Webhook-Signature</code> 头 (HMAC-SHA256)。</p>
          </div>
          <div>
            <label class="text-sm text-gray-500">公司名称</label>
            <input v-model="editForm.company_name" type="text" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="客户公司名称" />
          </div>
          <div>
            <label class="text-sm text-gray-500">联系邮箱</label>
            <input v-model="editForm.contact_email" type="text" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="billing@client.com" />
          </div>
          <div>
            <label class="text-sm text-gray-500">联系电话</label>
            <input v-model="editForm.contact_phone" type="text" class="w-full border rounded px-3 py-1.5 text-sm" placeholder="13800138000" />
          </div>
          <div>
            <label class="text-sm text-gray-500">可用国家线路</label>
            <div class="flex gap-4 mt-1">
              <label class="flex items-center gap-1 text-sm">
                <input type="checkbox" value="jp" v-model="editForm.countries" />
                Japan
              </label>
              <label class="flex items-center gap-1 text-sm">
                <input type="checkbox" value="us" v-model="editForm.countries" />
                USA
              </label>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-4">
          <button @click="showEdit = false" class="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
          <button @click="doUpdate" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>

    <!-- Regenerated Key Modal -->
    <div v-if="showNewKey" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div class="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
        <h3 class="text-lg font-semibold mb-2">New API Key Generated</h3>
        <p class="text-sm text-gray-500 mb-3">Save this key now. It will not be shown again.</p>
        <code class="block bg-green-50 border border-green-200 rounded p-3 text-sm font-mono break-all mb-4">{{ newKeyValue }}</code>
        <div class="bg-gray-50 border rounded p-3 mb-4 text-xs space-y-3">
          <p class="font-semibold text-gray-700">API 调用方式</p>
          <p class="text-gray-500">在请求头中携带 <code class="bg-gray-200 px-1 rounded">X-API-Key</code> 即可：</p>
          <pre class="bg-gray-800 text-green-400 p-2 rounded overflow-auto"><code>curl -X POST "http://YOUR_SERVER/api/v1/classify" \
  -H "X-API-Key: {{ newKeyValue }}" \
  -H "Content-Type: application/json" \
  -d '{"raw_description":"Laptop Computer"}'</code></pre>
          <p class="text-gray-500">响应中自动包含数据完整性校验字段：</p>
          <ul class="list-disc list-inside text-gray-500 space-y-1">
            <li><code>request_hash</code> — 你发送的请求体 SHA256 指纹</li>
            <li><code>response_hash</code> — 你收到的响应体 SHA256 指纹</li>
          </ul>
          <p class="text-gray-400">出现数据争议时，双方各自计算 SHA256 比对这两个字段即可确认数据是否被篡改。</p>

          <details>
            <summary class="font-medium text-gray-500 cursor-pointer">可选：HMAC-SHA256 签名（法律级防抵赖）</summary>
            <div class="mt-2 space-y-2">
              <details>
                <summary class="text-blue-600 cursor-pointer">Python</summary>
                <pre class="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-auto"><code>import hmac, hashlib, json
body = json.dumps({"raw_description":"Product"}, separators=(",",":"))
sig = hmac.new("{{ newKeyValue }}".encode(), body.encode(), hashlib.sha256).hexdigest()
# Header: X-Signature: {sig}</code></pre>
              </details>
              <details>
                <summary class="text-blue-600 cursor-pointer">Node.js</summary>
                <pre class="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-auto"><code>const crypto = require("crypto");
const body = JSON.stringify({raw_description:"Product"});
const sig = crypto.createHmac("sha256","{{ newKeyValue }}").update(body).digest("hex");</code></pre>
              </details>
            </div>
          </details>
        </div>
        <button @click="showNewKey = false" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Done</button>
      </div>
    </div>

    <p v-if="error" class="mt-4 text-red-500">{{ error }}</p>
    <p v-if="msg" class="mt-4 text-green-600">{{ msg }}</p>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import AppLayout from "../components/AppLayout.vue";
import api, { deleteUser } from "../api";

interface UserRow {
  id: string;
  name: string;
  api_key: string;
  permissions: string[];
  active: number;
  created_at: string;
  last_used_at: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  webhook_enabled: number;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  countries: string[];
  monthly_calls: number;
}

const users = ref<UserRow[]>([]);
const allPerms = ref<string[]>([]);
const error = ref("");
const msg = ref("");

const showCreate = ref(false);
const showEdit = ref(false);
const showNewKey = ref(false);
const newKeyValue = ref("");
const editTargetId = ref("");

const form = reactive({ name: "", permissions: [] as string[] });
const editForm = reactive({ name: "", permissions: [] as string[], webhook_url: "", webhook_secret: "", webhook_enabled: false, company_name: "", contact_email: "", contact_phone: "", countries: ["jp"] as string[] });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

async function loadUsers() {
  try {
    const r = await api.get("/users");
    users.value = r.data.users;
  } catch {
    error.value = "Failed to load users";
  }
}

async function loadPerms() {
  try {
    const r = await api.get("/permissions");
    allPerms.value = r.data.permissions;
  } catch {
    // ignore
  }
}

async function doCreate() {
  try {
    error.value = "";
    const r = await api.post("/users", { name: form.name, permissions: form.permissions });
    const u = r.data.user;
    showCreate.value = false;
    // Show key with signature instructions
    newKeyValue.value = u.api_key;
    showNewKey.value = true;
    form.name = "";
    form.permissions = [];
    await loadUsers();
  } catch {
    error.value = "Failed to create user";
  }
}

function editUser(u: UserRow) {
  editTargetId.value = u.id;
  editForm.name = u.name;
  editForm.permissions = [...u.permissions];
  editForm.webhook_url = u.webhook_url || "";
  editForm.webhook_secret = u.webhook_secret || "";
  editForm.webhook_enabled = u.webhook_enabled === 1;
  editForm.company_name = u.company_name || "";
  editForm.contact_email = u.contact_email || "";
  editForm.contact_phone = u.contact_phone || "";
  editForm.countries = u.countries || ["jp"];
  showEdit.value = true;
}

async function doUpdate() {
  try {
    error.value = "";
    await api.put(`/users/${editTargetId.value}`, {
      name: editForm.name, permissions: editForm.permissions,
      webhook_url: editForm.webhook_url || null,
      webhook_enabled: editForm.webhook_enabled,
      company_name: editForm.company_name || null,
      contact_email: editForm.contact_email || null,
      contact_phone: editForm.contact_phone || null,
      countries: editForm.countries,
    });
    showEdit.value = false;
    await loadUsers();
  } catch {
    error.value = "Failed to update user";
  }
}

async function confirmToggle(u: UserRow) {
  try {
    await api.put(`/users/${u.id}`, { active: u.active ? 0 : 1 });
    await loadUsers();
  } catch {
    error.value = "Failed to toggle user status";
  }
}

async function confirmRegenerate(u: UserRow) {
  try {
    const r = await api.post(`/users/${u.id}/regenerate-key`);
    newKeyValue.value = r.data.user.api_key;
    showNewKey.value = true;
    await loadUsers();
  } catch {
    error.value = "Failed to regenerate key";
  }
}

async function confirmDelete(u: UserRow) {
  if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
  try {
    await deleteUser(u.id);
    await loadUsers();
  } catch {
    error.value = "Failed to delete user";
  }
}

onMounted(() => {
  loadUsers();
  loadPerms();
});
</script>
