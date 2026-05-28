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
            <th class="text-left px-4 py-3">Status</th>
            <th class="text-left px-4 py-3">Created</th>
            <th class="text-left px-4 py-3">Last Used</th>
            <th class="text-left px-4 py-3 w-16">Webhook</th>
            <th class="text-left px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0">
            <td colspan="7" class="px-4 py-8 text-center text-gray-400">No users</td>
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
            <label class="text-sm text-gray-500">Webhook URL</label>
            <div class="flex gap-2">
              <input v-model="editForm.webhook_url" type="text" class="flex-1 border rounded px-3 py-1.5 text-sm" placeholder="https://your-server.com/webhook" />
              <button @click="generateWebhookUrl" class="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap">Generate</button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" v-model="editForm.webhook_enabled" />
            <label class="text-sm text-gray-500">Enable Webhook</label>
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
          <p class="font-semibold text-gray-700">请求签名 (HMAC-SHA256) — 发送给客户的多语言示例</p>

          <details class="mb-2" open>
            <summary class="font-medium text-blue-600 cursor-pointer">Python</summary>
            <pre class="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-auto"><code>import hmac, hashlib, requests, json

API_KEY = "{{ newKeyValue }}"
body = {"raw_description": "Laptop Computer"}

body_str = json.dumps(body, separators=(",", ":"))
sig = hmac.new(API_KEY.encode(), body_str.encode(), hashlib.sha256).hexdigest()

resp = requests.post(
    "http://YOUR_SERVER/api/v1/classify",
    data=body_str,
    headers={"X-API-Key": API_KEY, "X-Signature": sig, "Content-Type": "application/json"}
)
print(resp.json())</code></pre>
          </details>

          <details>
            <summary class="font-medium text-blue-600 cursor-pointer">Node.js / TypeScript</summary>
            <pre class="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-auto"><code>const crypto = require("crypto");

const API_KEY = "{{ newKeyValue }}";
const body = JSON.stringify({ raw_description: "Laptop Computer" });

const sig = crypto.createHmac("sha256", API_KEY).update(body).digest("hex");

const resp = await fetch("http://YOUR_SERVER/api/v1/classify", {
  method: "POST",
  body,
  headers: {"X-API-Key": API_KEY, "X-Signature": sig, "Content-Type": "application/json"}
});
console.log(await resp.json());</code></pre>
          </details>

          <details>
            <summary class="font-medium text-blue-600 cursor-pointer">Java</summary>
            <pre class="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-auto"><code>import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.http.*;

String apiKey = "{{ newKeyValue }}";
String body = "{\"raw_description\":\"Laptop Computer\"}";

Mac mac = Mac.getInstance("HmacSHA256");
mac.init(new SecretKeySpec(apiKey.getBytes(), "HmacSHA256"));
String sig = bytesToHex(mac.doFinal(body.getBytes()));

HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("http://YOUR_SERVER/api/v1/classify"))
    .header("X-API-Key", apiKey)
    .header("X-Signature", sig)
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();</code></pre>
          </details>

          <details>
            <summary class="font-medium text-blue-600 cursor-pointer">cURL (bash)</summary>
            <pre class="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-auto"><code>API_KEY="{{ newKeyValue }}"
BODY='{"raw_description":"Laptop Computer"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$API_KEY" | awk '{print $2}')

curl -X POST "http://YOUR_SERVER/api/v1/classify" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Signature: $SIG" \
  -H "Content-Type: application/json" \
  -d "$BODY"</code></pre>
          </details>

          <details>
            <summary class="font-medium text-blue-600 cursor-pointer">PHP</summary>
            <pre class="bg-gray-800 text-green-400 p-2 rounded mt-1 overflow-auto"><code>$API_KEY = "{{ newKeyValue }}";
$body = json_encode(["raw_description" => "Laptop Computer"], JSON_UNESCAPED_UNICODE);

$sig = hash_hmac("sha256", $body, $API_KEY);

$ch = curl_init("http://YOUR_SERVER/api/v1/classify");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => [
        "X-API-Key: $API_KEY",
        "X-Signature: $sig",
        "Content-Type: application/json"
    ],
    CURLOPT_RETURNTRANSFER => true,
]);
echo curl_exec($ch);</code></pre>
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
  webhook_enabled: number;
  company_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
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
const editForm = reactive({ name: "", permissions: [] as string[], webhook_url: "", webhook_enabled: false, company_name: "", contact_email: "", contact_phone: "" });

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
  editForm.webhook_enabled = u.webhook_enabled === 1;
  editForm.company_name = u.company_name || "";
  editForm.contact_email = u.contact_email || "";
  editForm.contact_phone = u.contact_phone || "";
  showEdit.value = true;
}

function generateWebhookUrl() {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
  const base = window.location.origin;
  editForm.webhook_url = `${base}/api/v1/webhook/in/${editTargetId.value}/${token}`;
  editForm.webhook_enabled = true;
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
