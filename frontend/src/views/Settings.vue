<template>
  <AppLayout>
    <h1 class="text-2xl font-bold mb-6">Settings</h1>

    <div class="flex gap-2 mb-4">
      <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key"
        class="px-4 py-2 rounded text-sm font-medium transition-colors"
        :class="activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'">
        {{ tab.label }}
      </button>
    </div>

    <!-- Credentials Tab -->
    <div v-if="activeTab === 'credentials'" class="bg-white rounded-lg shadow border p-6 max-w-2xl">
      <p class="text-sm text-gray-500 mb-6">
        Manage API credentials. Credentials stored here override the <code class="bg-gray-100 px-1 rounded">.env</code> file values at runtime.
      </p>
      <div class="space-y-5">
        <div v-for="cred in credentials" :key="cred.key" class="border rounded p-4">
          <div class="flex justify-between items-center mb-1">
            <label class="text-sm font-semibold text-gray-700">{{ cred.key }}</label>
            <span :class="cred.configured ? 'bg-green-100 text-green-700' : cred.optional ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'"
              class="px-2 py-0.5 rounded text-xs font-medium">
              {{ cred.configured ? 'Configured' : cred.optional ? 'Optional' : 'Not set' }}
            </span>
          </div>
          <p class="text-xs text-gray-400 mb-2">{{ cred.description }}</p>
          <div v-if="editingCred === cred.key" class="space-y-2">
            <input v-model="editCredValues[cred.key]" type="text" class="w-full border rounded px-3 py-2 text-sm font-mono"
              :placeholder="'Enter ' + cred.key" />
            <div class="flex gap-2">
              <button @click="saveCredential(cred.key)" class="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Save</button>
              <button @click="cancelCredEdit()" class="px-4 py-1.5 border rounded text-sm hover:bg-gray-100">Cancel</button>
            </div>
          </div>
          <div v-else class="flex justify-between items-center">
            <code class="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 max-w-md truncate block">{{ cred.masked || '(empty)' }}</code>
            <button @click="startCredEdit(cred.key)" class="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50">Edit</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Company Info Tab -->
    <div v-if="activeTab === 'company'" class="bg-white rounded-lg shadow border p-6 max-w-2xl">
      <h3 class="font-semibold mb-4">服务商公司信息</h3>
      <div class="space-y-3">
        <div>
          <label class="text-sm text-gray-500">公司名称</label>
          <input v-model="companyForm.company_name" type="text" class="w-full border rounded px-3 py-2 text-sm" placeholder="XX科技有限公司" />
        </div>
        <div>
          <label class="text-sm text-gray-500">地址</label>
          <input v-model="companyForm.address" type="text" class="w-full border rounded px-3 py-2 text-sm" placeholder="上海市浦东新区XX路XX号" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-sm text-gray-500">电话</label>
            <input v-model="companyForm.phone" type="text" class="w-full border rounded px-3 py-2 text-sm" placeholder="021-12345678" />
          </div>
          <div>
            <label class="text-sm text-gray-500">邮箱</label>
            <input v-model="companyForm.email" type="text" class="w-full border rounded px-3 py-2 text-sm" placeholder="billing@example.com" />
          </div>
        </div>
        <div>
          <label class="text-sm text-gray-500">税号</label>
          <input v-model="companyForm.tax_id" type="text" class="w-full border rounded px-3 py-2 text-sm" placeholder="91310000XXXXXXXXXX" />
        </div>
        <button @click="saveCompanyInfo" class="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">保存公司信息</button>
      </div>
    </div>

    <!-- Pricing Tab -->
    <div v-if="activeTab === 'pricing'" class="bg-white rounded-lg shadow border p-6 max-w-2xl">
      <h3 class="font-semibold mb-4">接口计费设置 (¥人民币/次)</h3>
      <table class="w-full text-sm border">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-2">接口</th>
            <th class="text-right px-4 py-2">当前单价</th>
            <th class="text-right px-4 py-2 w-32">新单价</th>
            <th class="text-center px-4 py-2 w-20"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(label, key) in endpointLabels" :key="key" class="border-t">
            <td class="px-4 py-2">{{ label }}</td>
            <td class="text-right px-4 py-2 font-mono">¥{{ (pricingInfo as any)[key]?.toFixed(2) }}</td>
            <td class="px-4 py-2">
              <input v-model="pricingEdits[key]" type="number" step="0.01" min="0" class="w-full border rounded px-2 py-1 text-sm text-right" placeholder="0.00" />
            </td>
            <td class="px-4 py-2 text-center">
              <button @click="savePrice(key)" class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="message" :class="messageType === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'"
      class="mt-4 p-3 rounded border text-sm max-w-2xl">{{ message }}</div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from "vue";
import AppLayout from "../components/AppLayout.vue";
import api, { fetchCompanyInfo, updateCompanyInfo, fetchPricing, updatePricing } from "../api";

interface CredentialStatus {
  key: string; configured: boolean; masked: string; optional: boolean; description: string;
}

const tabs = [
  { key: "credentials", label: "凭证" },
  { key: "company", label: "公司信息" },
  { key: "pricing", label: "计费设置" },
];
const activeTab = ref("credentials");

const credentials = ref<CredentialStatus[]>([]);
const editingCred = ref<string | null>(null);
const editCredValues = reactive<Record<string, string>>({});
const message = ref("");
const messageType = ref<"success" | "error">("success");

const endpointLabels: Record<string, string> = {
  address: "地址清洗 (Address Cleanse)",
  name: "姓名清洗 (Name Cleanse)",
  item: "商品清洗 (Item Cleanse)",
  classify: "HS编码分类 (Classify)",
  compliance: "JP-合规检查 (Compliance)",
  us_classify: "US-HS分类 (Classify)",
  us_address: "US-地址清洗 (Address)",
  us_compliance: "US-合规检查 (Compliance)",
};

const companyForm = reactive({
  company_name: "", address: "", phone: "", email: "", tax_id: "",
});

const pricingInfo = reactive<Record<string, number>>({
  address: 0.10, name: 0.10, item: 0.20, classify: 0.30, compliance: 0.20,
  us_classify: 0.30, us_address: 0.15, us_compliance: 0.25,
});
const pricingEdits = reactive<Record<string, number>>({
  address: 0, name: 0, item: 0, classify: 0, compliance: 0,
  us_classify: 0, us_address: 0, us_compliance: 0,
});

// === Credentials ===
async function loadSettings() {
  try {
    const res = await api.get("/settings");
    credentials.value = res.data.credentials;
  } catch {
    message.value = "Failed to load settings"; messageType.value = "error";
  }
}
function startCredEdit(key: string) { editingCred.value = key; editCredValues[key] = ""; }
function cancelCredEdit() { editingCred.value = null; }

async function saveCredential(key: string) {
  try {
    await api.put("/settings", { credentials: { [key]: editCredValues[key] } });
    editingCred.value = null;
    message.value = `${key} updated successfully`; messageType.value = "success";
    await loadSettings();
  } catch {
    message.value = `Failed to update ${key}`; messageType.value = "error";
  }
}

// === Company ===
async function loadCompanyInfo() {
  try {
    const r = await fetchCompanyInfo();
    const c = r.data.company;
    if (c) Object.assign(companyForm, c);
  } catch { /* ignore */ }
}

async function saveCompanyInfo() {
  try {
    await updateCompanyInfo(companyForm);
    message.value = "公司信息已保存"; messageType.value = "success";
  } catch {
    message.value = "保存失败"; messageType.value = "error";
  }
}

// === Pricing ===
async function loadPricing() {
  try {
    const r = await fetchPricing();
    if (r.data.pricing) Object.assign(pricingInfo, r.data.pricing);
  } catch { /* ignore */ }
}

async function savePrice(key: string) {
  try {
    const val = Number(pricingEdits[key]);
    if (isNaN(val) || val < 0) { message.value = "请输入有效价格"; messageType.value = "error"; return; }
    await updatePricing({ [key]: val } as any);
    (pricingInfo as any)[key] = val;
    pricingEdits[key] = 0;
    message.value = `${endpointLabels[key]} 价格已更新`; messageType.value = "success";
  } catch {
    message.value = "价格更新失败"; messageType.value = "error";
  }
}

onMounted(() => {
  loadSettings();
  loadCompanyInfo();
  loadPricing();
});
</script>
