<template>
  <AppLayout>
    <h1 class="text-2xl font-bold mb-6">HS Code Tools</h1>

    <!-- ===== Unified Classify / Verify Form ===== -->
    <div class="bg-white rounded-lg shadow border p-4 mb-6">
      <h2 class="text-lg font-semibold mb-1">HS Code Classification</h2>
      <p class="text-sm text-gray-500 mb-4">Enter a product description to find matching HS codes. Optionally provide an HS code to verify the match.</p>

      <div class="flex flex-col gap-3 mb-4">
        <div class="flex gap-3 items-end">
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs text-gray-500">Product Description *</label>
            <input
              v-model="classifyDesc"
              type="text"
              placeholder="e.g. Laptop Computer, Plastic Toy Car, Frozen Salmon Fillet..."
              class="border rounded px-3 py-2 text-sm w-full"
              @keyup.enter="doClassify"
            />
          </div>
          <div class="flex flex-col gap-1 w-44">
            <label class="text-xs text-gray-500">HS Code (optional)</label>
            <input
              v-model="classifyHs"
              type="text"
              placeholder="e.g. 84713000"
              class="border rounded px-3 py-2 text-sm"
              @keyup.enter="doClassify"
            />
          </div>
          <button
            @click="doClassify"
            :disabled="classifyLoading || !classifyDesc.trim()"
            class="px-6 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 self-end"
          >
            {{ classifyLoading ? 'Classifying...' : 'Classify' }}
          </button>
        </div>
        <p v-if="classifyError" class="mt-2 text-red-500 text-sm">{{ classifyError }}</p>
      </div>

      <!-- Results -->
      <div v-if="classifyResult" class="mt-4 space-y-4">
        <!-- Suggested Name -->
        <div v-if="classifyResult.suggested_name_cn" class="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-sm text-blue-800 font-bold">{{ classifyResult.suggested_name_cn }}</div>
              <div class="text-xs text-blue-600 mt-0.5">{{ classifyResult.suggested_name_en }}</div>
            </div>
            <span v-if="classifyResult.consensus" class="shrink-0 ml-3 px-2 py-0.5 rounded text-xs font-medium"
              :class="classifyResult.consensus.agreed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
            >
              {{ classifyResult.consensus.agreed ? 'Dual ✓' : classifyResult.consensus.both_available ? 'Review' : (classifyResult.consensus.primary_model || 'local') }}
            </span>
          </div>
        </div>

        <!-- 6-Dimension Attributes Table -->
        <div v-if="classifyResult.structured_attributes" class="bg-white rounded-lg border overflow-hidden">
          <div class="px-4 py-2 bg-gray-50 border-b text-sm font-medium">Product Attributes</div>
          <div v-for="row in attrRows" :key="row.key" class="px-4 py-2 border-b last:border-b-0 flex">
            <span class="text-xs text-gray-500 w-20 shrink-0">{{ row.label }}</span>
            <span class="text-sm text-gray-800">{{ row.cn }}</span>
            <span v-if="row.en && row.en !== row.cn" class="text-xs text-gray-400 ml-2">{{ row.en }}</span>
          </div>
        </div>

        <!-- Extracted keywords -->
        <div v-if="classifyResult.extracted_keywords.length" class="flex flex-wrap items-center gap-1.5 p-3 bg-blue-50 border border-blue-200 rounded">
          <span class="text-xs text-blue-600 font-medium mr-1">Keywords:</span>
          <span v-for="(kw, ki) in classifyResult.extracted_keywords" :key="ki"
            class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
          >{{ kw }}</span>
        </div>

        <!-- Verification result -->
        <div v-if="classifyResult.verification" class="p-3 rounded text-sm"
          :class="classifyResult.verification.matched
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'"
        >
          <span v-if="classifyResult.verification.matched">Verified: </span>
          <span v-else>Mismatch: </span>
          {{ classifyResult.verification.detail }}
        </div>

        <!-- Best guess -->
        <div v-if="classifyResult.best_guess" class="p-4 bg-blue-50 border border-blue-200 rounded">
          <div class="text-sm text-blue-600 font-medium mb-1">Best Match</div>
          <div class="text-2xl font-bold text-blue-800 font-mono">{{ classifyResult.best_guess.hs_code }}</div>
          <div class="text-sm text-blue-700 mt-1">{{ classifyResult.best_guess.description_en }}</div>
          <div class="text-sm text-blue-500">{{ classifyResult.best_guess.description_cn }}</div>
          <div class="flex items-center gap-3 mt-2 flex-wrap">
            <span class="text-xs text-blue-400">Confidence: {{ Math.round(classifyResult.best_guess.confidence * 100) }}%</span>
            <span v-if="classifyResult.best_guess.matched_keywords.length" class="flex items-center gap-1">
              <span class="text-xs text-blue-400">Matched:</span>
              <span v-for="(mk, mi) in classifyResult.best_guess.matched_keywords" :key="mi"
                class="inline-block px-1.5 py-0.5 rounded text-xs bg-blue-200 text-blue-700"
              >{{ mk }}</span>
            </span>
          </div>
        </div>

        <!-- All candidates -->
        <div v-if="classifyResult.candidates.length > 0" class="bg-white rounded-lg border">
          <div class="px-4 py-2 bg-gray-50 border-b text-sm font-medium">
            All Candidates ({{ classifyResult.candidates.length }})
          </div>
          <div v-for="(c, idx) in classifyResult.candidates.slice(0, 5)" :key="idx"
            class="px-4 py-3 border-b last:border-b-0"
          >
            <div class="flex justify-between items-start mb-1">
              <span class="font-mono font-semibold">{{ c.code }}</span>
              <span class="text-xs px-2 py-0.5 rounded shrink-0"
                :class="c.confidence >= 0.7 ? 'bg-green-100 text-green-700' : c.confidence >= 0.4 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'"
              >
                {{ Math.round(c.confidence * 100) }}%
              </span>
            </div>
            <div class="text-sm text-gray-700">{{ c.description }}</div>
            <div class="text-sm text-gray-500 mt-0.5" v-if="c.description_cn">{{ c.description_cn }}</div>
            <div v-if="c.matched_keywords.length" class="flex items-center gap-1 mt-1">
              <span class="text-xs text-gray-400">Matched:</span>
              <span v-for="(mk, mi) in c.matched_keywords" :key="mi"
                class="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600"
              >{{ mk }}</span>
            </div>
          </div>
        </div>

        <!-- Compliance warnings (when HS code provided and mismatch) -->
        <div v-if="classifyResult.compliance && classifyResult.compliance.warnings.length > 0">
          <div v-for="w in classifyResult.compliance.warnings" :key="w.check"
            class="flex items-start gap-2 p-2 rounded text-sm"
            :class="w.level === 'blocked' ? 'bg-red-50 text-red-700' :
                    w.level === 'restricted' ? 'bg-orange-50 text-orange-700' :
                    w.level === 'warning' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'"
          >
            <span class="inline-block px-1.5 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5"
              :class="w.level === 'blocked' ? 'bg-red-200' : w.level === 'restricted' ? 'bg-orange-200' : w.level === 'warning' ? 'bg-yellow-200' : 'bg-green-200'"
            >{{ w.level }}</span>
            <span>{{ w.message }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Compliance Check (batch) ===== -->
    <div class="bg-white rounded-lg shadow border p-4 mb-6">
      <h2 class="text-lg font-semibold mb-1">Batch Compliance Check</h2>
      <p class="text-sm text-gray-500 mb-4">Check multiple items at once (HS code + declared value)</p>
      <div class="space-y-3 mb-4">
        <div v-for="(item, idx) in items" :key="idx" class="flex gap-3 items-start border rounded p-3 bg-gray-50">
          <div class="flex-1 flex gap-3 items-start flex-wrap">
            <div class="flex flex-col gap-1 min-w-[200px]">
              <label class="text-xs text-gray-500">Description</label>
              <input v-model="item.raw_description" type="text" placeholder="e.g. Laptop Computer" class="border rounded px-2 py-1.5 text-sm w-full" />
            </div>
            <div class="flex flex-col gap-1 min-w-[120px]">
              <label class="text-xs text-gray-500">HS Code</label>
              <input v-model="item.hs_code" type="text" placeholder="84713000" class="border rounded px-2 py-1.5 text-sm w-28" />
            </div>
            <div class="flex flex-col gap-1 min-w-[120px]">
              <label class="text-xs text-gray-500">Value (JPY)</label>
              <input v-model.number="item.declared_value_jpy" type="number" placeholder="5000" min="1" class="border rounded px-2 py-1.5 text-sm w-28" />
            </div>
          </div>
          <button @click="removeItem(idx)" class="mt-5 text-red-500 hover:text-red-700 text-sm px-2 py-1" v-if="items.length > 1">Remove</button>
        </div>
      </div>
      <div class="flex gap-3">
        <button @click="addItem" class="px-4 py-1.5 border border-blue-600 text-blue-600 rounded text-sm hover:bg-blue-50">+ Add Item</button>
        <button @click="check" :disabled="checking" class="px-6 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">{{ checking ? 'Checking...' : 'Check All' }}</button>
      </div>

      <div v-if="compResults.length > 0" class="mt-4 space-y-3">
        <div v-for="(r, idx) in compResults" :key="idx" class="border rounded overflow-hidden">
          <div class="px-3 py-2 flex justify-between items-center" :class="r.compliance.passed ? 'bg-green-50' : 'bg-red-50'">
            <div><span class="font-semibold text-sm">{{ r.raw_description }}</span><span class="text-gray-500 text-sm ml-3">HS: {{ r.hs_code }}</span></div>
            <span class="px-2 py-0.5 rounded text-xs font-medium" :class="r.compliance.passed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'">{{ r.compliance.passed ? 'PASS' : 'REVIEW' }}</span>
          </div>
          <div v-if="r.compliance.warnings.length" class="px-3 py-2">
            <div v-for="(w, wi) in r.compliance.warnings" :key="wi" class="flex gap-2 py-0.5 text-sm">
              <span class="inline-block px-1 py-0 rounded text-xs font-medium shrink-0 mt-0.5" :class="wb(w.level)">{{ w.level }}</span>
              <span>{{ w.message }}</span>
            </div>
          </div>
        </div>
      </div>
      <p v-if="error" class="mt-4 text-red-500 text-sm">{{ error }}</p>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import AppLayout from "../components/AppLayout.vue";
import { fetchComplianceCheck, fetchClassify, type ComplianceCheckItem, type ClassifyResponse } from "../api";

// --- Classify mode ---
const classifyDesc = ref("");
const classifyHs = ref("");
const classifyLoading = ref(false);
const classifyResult = ref<ClassifyResponse | null>(null);
const classifyError = ref("");

const attrRows = computed(() => {
  const a = classifyResult.value?.structured_attributes;
  if (!a) return [];
  const dims = [
    { key: "core_product", label: "Core Product", cn: a.core_product_cn, en: a.core_product_en },
    { key: "material", label: "Material", cn: a.material_cn, en: a.material_en },
    { key: "function", label: "Function", cn: a.function_cn, en: a.function_en },
    { key: "composition", label: "Composition", cn: a.composition_cn, en: a.composition_en },
    { key: "processing", label: "Processing", cn: a.processing_cn, en: a.processing_en },
    { key: "structure", label: "Structure", cn: a.structure_cn, en: a.structure_en },
    { key: "technical", label: "Technical", cn: a.technical_cn, en: a.technical_en },
  ];
  return dims.filter(d => d.cn);
});

async function doClassify() {
  if (!classifyDesc.value.trim()) return;
  classifyLoading.value = true;
  classifyResult.value = null;
  classifyError.value = "";
  try {
    const res = await fetchClassify(
      classifyDesc.value.trim(),
      classifyHs.value.trim() || undefined
    );
    classifyResult.value = res.data;
  } catch (e: any) {
    classifyError.value = e?.response?.data?.message || e?.message || "Classification failed";
  }
  finally { classifyLoading.value = false; }
}

// --- Batch compliance mode ---
const items = reactive<{ raw_description: string; hs_code: string; declared_value_jpy: number }[]>([
  { raw_description: "", hs_code: "", declared_value_jpy: 0 },
]);
const compResults = ref<ComplianceCheckItem[]>([]);
const checking = ref(false);
const error = ref("");

function addItem() { items.push({ raw_description: "", hs_code: "", declared_value_jpy: 0 }); }
function removeItem(idx: number) { items.splice(idx, 1); }
function wb(level: string) {
  const m: Record<string, string> = { passed: "bg-green-100 text-green-700", warning: "bg-yellow-100 text-yellow-700", restricted: "bg-orange-100 text-orange-700", blocked: "bg-red-100 text-red-700" };
  return m[level] || "bg-gray-100 text-gray-700";
}

async function check() {
  const valid = items.filter((i) => i.raw_description.trim() && i.hs_code.trim() && i.declared_value_jpy > 0);
  if (valid.length === 0) { error.value = "Fill at least one item"; return; }
  checking.value = true; error.value = "";
  try {
    const res = await fetchComplianceCheck(valid);
    compResults.value = res.data.results;
  } catch { error.value = "Check failed"; }
  finally { checking.value = false; }
}
</script>
