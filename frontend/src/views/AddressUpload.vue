<template>
  <AppLayout>
    <h1 class="text-2xl font-bold mb-6">Address Batch Upload</h1>

    <div class="space-y-6">
      <div class="bg-white rounded-lg shadow border p-6">
        <h2 class="text-lg font-semibold mb-3">1. Select Excel File</h2>
        <label class="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
          <svg class="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          <span class="text-blue-600 font-medium">{{ fileName || 'Click to select .xlsx or .xls file' }}</span>
          <span v-if="!fileName" class="text-xs text-gray-400">Excel must have columns for address and zipcode</span>
          <input type="file" accept=".xlsx,.xls" @change="onFileChange" ref="fileInput" class="hidden" />
        </label>
      </div>

      <div v-if="headers.length > 0" class="bg-white rounded-lg shadow border p-4">
        <h2 class="text-lg font-semibold mb-3">2. Column Mapping</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">県 (Prefecture)</label>
            <select v-model="mapping.prefecture" class="border rounded px-2 py-1.5 text-sm"><option value="">-- none --</option><option v-for="h in headers" :key="h" :value="h">{{ h }}</option></select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">市 (City)</label>
            <select v-model="mapping.city" class="border rounded px-2 py-1.5 text-sm"><option value="">-- none --</option><option v-for="h in headers" :key="h" :value="h">{{ h }}</option></select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">区 (Ward)</label>
            <select v-model="mapping.ward" class="border rounded px-2 py-1.5 text-sm"><option value="">-- none --</option><option v-for="h in headers" :key="h" :value="h">{{ h }}</option></select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">具体地址 (Address) *</label>
            <select v-model="mapping.address" class="border rounded px-2 py-1.5 text-sm"><option value="">-- required --</option><option v-for="h in headers" :key="h" :value="h">{{ h }}</option></select>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-500">邮编 (Zipcode) *</label>
            <select v-model="mapping.zipcode" class="border rounded px-2 py-1.5 text-sm"><option value="">-- required --</option><option v-for="h in headers" :key="h" :value="h">{{ h }}</option></select>
          </div>
        </div>
      </div>

      <div v-if="mapping.address && mapping.zipcode" class="bg-white rounded-lg shadow border p-4">
        <h2 class="text-lg font-semibold mb-3">3. Start Cleanse</h2>
        <button @click="startCleanse" :disabled="processing" class="w-full py-3 bg-blue-600 text-white rounded-lg text-base font-medium hover:bg-blue-700 disabled:opacity-50">
          {{ processing ? 'Processing...' : 'Start Cleanse' }}
        </button>
        <div v-if="processing" class="mt-3">
          <div class="text-sm text-gray-600">Processing {{ totalRows }} rows...</div>
          <div class="w-full bg-gray-200 rounded h-2 mt-1"><div class="bg-blue-600 h-2 rounded transition-all" :style="{ width: progress + '%' }"></div></div>
        </div>
      </div>

      <!-- Results Table -->
      <div v-if="rows.length > 0" class="bg-white rounded-lg shadow border overflow-hidden">
        <div class="p-4 border-b flex justify-between items-center">
          <h2 class="text-lg font-semibold">
            Results: {{ verifiedCount }} verified, {{ needsReviewCount }} need review
          </h2>
          <button @click="downloadExcel" :disabled="downloading" class="px-6 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
            {{ downloading ? 'Generating...' : 'Download Excel' }}
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b">
              <tr>
                <th class="text-left px-3 py-2 w-10">#</th>
                <th class="text-left px-3 py-2">原始地址</th>
                <th class="text-left px-3 py-2">提取数字</th>
                <th class="text-left px-3 py-2">验证后地址</th>
                <th class="text-left px-3 py-2">修正地址</th>
                <th class="text-center px-3 py-2 w-20">状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in rows" :key="idx" class="border-b" :class="r.status !== 'verified' ? 'bg-red-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'">
                <td class="px-3 py-2 text-gray-400">{{ idx + 1 }}</td>
                <td class="px-3 py-2 text-xs max-w-48 truncate" :title="r.fullAddr || r.addr">{{ r.fullAddr || r.addr }}</td>
                <td class="px-3 py-2">
                  <div v-if="r.dashSegments?.length" class="flex flex-wrap gap-1">
                    <span v-for="(seg, si) in r.dashSegments" :key="si"
                      @click="appendSegment(idx, seg)"
                      class="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs cursor-pointer hover:bg-blue-200"
                      :title="'Click to append to correction'">
                      {{ seg }}
                    </span>
                  </div>
                  <span v-else class="text-gray-300">—</span>
                </td>
                <td class="px-3 py-2 text-xs max-w-48 truncate" :title="r.validatedFull">{{ r.validatedFull || r.validatedBase || '—' }}</td>
                <td class="px-3 py-2">
                  <div v-if="r.status !== 'verified'" class="flex gap-1">
                    <input v-model="r.correction" class="border rounded px-2 py-1 text-xs flex-1 w-40" />
                    <button @click="saveCorrection(idx)" class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0">保存</button>
                    <span v-if="r._saved" class="text-green-600 text-xs self-center shrink-0">已保存</span>
                  </div>
                  <span v-else class="text-xs text-green-700">{{ r.correction }}</span>
                </td>
                <td class="px-3 py-2 text-center">
                  <span :class="r.status === 'verified' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'" class="px-1.5 py-0.5 rounded text-xs font-medium">
                    {{ r.status === 'verified' ? '✓' : '⚠' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import AppLayout from "../components/AppLayout.vue";
import api from "../api";
import * as XLSX from "xlsx";

const fileInput = ref<HTMLInputElement>();
const fileName = ref("");
const headers = ref<string[]>([]);
const mapping = reactive({ prefecture: "", city: "", ward: "", address: "", zipcode: "" });
const processing = ref(false);
const progress = ref(0);
const totalRows = ref(0);
const rows = ref<any[]>([]);
const error = ref("");
const downloading = ref(false);

const verifiedCount = computed(() => rows.value.filter(r => r.status === "verified").length);
const needsReviewCount = computed(() => rows.value.filter(r => r.status !== "verified").length);

const AUTO_MAP: Record<string, string[]> = {
  prefecture: ["県", "prefecture", "都道府県", "pref", "ken", "todofuken"],
  city: ["市", "city", "市区", "city_name", "shi"],
  ward: ["区", "ward", "district", "町", "町域", "cho", "machi", "ku"],
  address: ["具体地址", "address", "住所", "番地", "detail", "street", "address_detail"],
  zipcode: ["邮编", "zip", "zipcode", "郵便番号", "postal_code", "postal"],
};

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  fileName.value = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const wb = XLSX.read(ev.target?.result, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (data.length > 0) {
      const h = data[0].map((c: any) => String(c || "").trim());
      headers.value = h;
      totalRows.value = data.length - 1;
      for (const [key, aliases] of Object.entries(AUTO_MAP)) {
        for (const hh of h) {
          if (aliases.includes(hh.toLowerCase())) { (mapping as any)[key] = hh; break; }
        }
      }
    }
  };
  reader.readAsArrayBuffer(file);
}

async function startCleanse() {
  const file = fileInput.value?.files?.[0];
  if (!file || !mapping.address || !mapping.zipcode) return;
  processing.value = true; error.value = ""; rows.value = []; progress.value = 10;
  const formData = new FormData();
  formData.append("file", file);
  if (mapping.prefecture) formData.append("prefecture_col", mapping.prefecture);
  if (mapping.city) formData.append("city_col", mapping.city);
  if (mapping.ward) formData.append("ward_col", mapping.ward);
  formData.append("address_col", mapping.address);
  formData.append("zip_col", mapping.zipcode);

  try {
    const resp = await api.post("/jp/cleanse/address/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
      onUploadProgress: (e) => { if (e.total) progress.value = Math.round((e.loaded / e.total) * 50); },
    });
    rows.value = resp.data.rows || [];
    progress.value = 100;
  } catch (e: any) {
    error.value = e?.response?.data?.message || e?.message || "Upload failed";
  }
  processing.value = false;
}

function appendSegment(idx: number, seg: string) {
  const row = rows.value[idx];
  if (!row) return;
  const sep = row.correction && !row.correction.endsWith("-") ? "-" : "";
  row.correction = (row.correction || "") + sep + seg;
}

function saveCorrection(idx: number) {
  const row = rows.value[idx];
  if (!row) return;
  row._saved = true;
  setTimeout(() => { row._saved = false; }, 1500);
}

async function downloadExcel() {
  downloading.value = true;
  try {
    const resp = await api.post("/jp/cleanse/address/download", { rows: rows.value }, {
      responseType: "blob",
    });
    const blob = new Blob([resp.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cleaned_addresses_${Date.now()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  } catch (e: any) {
    error.value = "Download failed";
  }
  downloading.value = false;
}
</script>
