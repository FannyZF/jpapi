<template>
  <AppLayout>
    <h1 class="text-2xl font-bold mb-6">HS Code Tools</h1>

    <div class="flex gap-2 mb-6">
      <button @click="country = 'jp'" class="px-4 py-2 rounded text-sm font-medium transition-colors"
        :class="country === 'jp' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'">Japan</button>
      <button @click="country = 'us'" class="px-4 py-2 rounded text-sm font-medium transition-colors"
        :class="country === 'us' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'">USA</button>
    </div>

    <!-- ===== Japan ===== -->
    <div v-show="country === 'jp'">

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
    </div>

    <!-- ===== USA ===== -->
    <div v-show="country === 'us'" class="space-y-6">
      <!-- USA Classify -->
      <div class="bg-white rounded-lg shadow border p-4">
        <h2 class="text-lg font-semibold mb-3">US HTS Code Classification</h2>
        <div class="flex gap-3 items-end mb-3">
          <div class="flex flex-col gap-1 flex-1">
            <label class="text-xs text-gray-500">Product Description *</label>
            <input v-model="usDesc" type="text" class="border rounded px-3 py-2 text-sm w-full" placeholder="e.g. Laptop Computer" @keyup.enter="doUsClassify" />
          </div>
          <div class="flex flex-col gap-1 w-44">
            <label class="text-xs text-gray-500">HTS Code (verify)</label>
            <input v-model="usHs" type="text" class="border rounded px-3 py-2 text-sm" placeholder="e.g. 84713000" @keyup.enter="doUsClassify" />
          </div>
          <button @click="doUsClassify" :disabled="usLoading" class="px-6 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {{ usLoading ? 'Classifying...' : 'Classify' }}
          </button>
        </div>
        <p v-if="usError" class="text-red-500 text-sm">{{ usError }}</p>

        <div v-if="usResult" class="mt-4 space-y-4">
          <!-- Suggested Name -->
          <div v-if="usResult.suggested_name" class="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded">
            <div class="text-sm text-blue-800 font-bold">{{ usResult.suggested_name }}</div>
          </div>
          <!-- Verification -->
          <div v-if="usResult.mode === 'verify'" class="p-3 rounded text-sm"
            :class="usResult.matched ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'">
            <span class="font-medium">{{ usResult.matched ? 'Matched' : 'Not matched' }}</span>
            <span class="text-xs ml-2">Provided: {{ usResult.provided_hs_code }} → Suggested: {{ usResult.suggested_hs_code || 'none' }}</span>
          </div>
          <!-- Best Match -->
          <div v-if="usResult.best_guess" class="p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded">
            <div class="flex justify-between items-start">
              <div>
                <div class="text-xs text-gray-500">Best Match</div>
                <div class="font-bold text-green-800">{{ usResult.best_guess.hs_code }}</div>
                <div class="text-sm text-gray-600">{{ usResult.best_guess.description }}</div>
              </div>
              <div class="text-right shrink-0 ml-3">
                <div class="text-lg font-bold text-green-700">{{ Math.round(usResult.best_guess.confidence * 100) }}%</div>
                <div class="text-xs text-gray-400">confidence</div>
              </div>
            </div>
            <div v-if="usResult.best_guess.matched_keywords?.length" class="mt-2 flex flex-wrap gap-1">
              <span v-for="k in usResult.best_guess.matched_keywords" :key="k" class="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">{{ k }}</span>
            </div>
          </div>
          <!-- Keywords -->
          <div v-if="usResult.extracted_keywords?.length" class="flex flex-wrap gap-1">
            <span class="text-xs text-gray-400 mr-1">Keywords:</span>
            <span v-for="k in usResult.extracted_keywords" :key="k" class="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{{ k }}</span>
          </div>
          <!-- All Candidates -->
          <div v-if="usResult.candidates?.length > 1" class="border rounded overflow-hidden">
            <div class="text-xs font-semibold text-gray-500 px-3 py-1.5 bg-gray-50 border-b">All Candidates</div>
            <div v-for="(c, ci) in usResult.candidates" :key="ci" class="px-3 py-2 flex justify-between items-center" :class="ci % 2 === 0 ? 'bg-white' : 'bg-gray-50'">
              <div>
                <span class="font-mono text-sm font-bold">{{ c.code }}</span>
                <span class="text-xs text-gray-500 ml-2">{{ c.description?.substring(0, 60) }}{{ c.description?.length > 60 ? '...' : '' }}</span>
              </div>
              <span class="text-xs font-bold text-blue-600">{{ Math.round(c.confidence * 100) }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- USA Compliance -->
      <div class="bg-white rounded-lg shadow border p-4">
        <h2 class="text-lg font-semibold mb-3">US Compliance Check</h2>
        <div v-for="(item, idx) in usItems" :key="idx" class="border rounded p-3 mb-2 bg-gray-50">
          <div class="flex gap-2 mb-2 items-end">
            <div class="flex flex-col gap-1 flex-1">
              <label class="text-xs text-gray-500">Product Description *</label>
              <input v-model="item.raw_description" type="text" class="w-full border rounded px-2 py-1 text-sm" placeholder="e.g. Lithium Battery Pack" />
            </div>
            <div class="flex flex-col gap-1 w-40">
              <label class="text-xs text-gray-500">HTS Code *</label>
              <input v-model="item.hs_code" type="text" class="w-full border rounded px-2 py-1 text-sm" placeholder="85076000" />
            </div>
            <div class="flex flex-col gap-1 w-32">
              <label class="text-xs text-gray-500">Value (USD)</label>
              <input v-model.number="item.declared_value_usd" type="number" class="w-full border rounded px-2 py-1 text-sm" placeholder="100" />
            </div>
            <button v-if="usItems.length > 1" @click="usItems.splice(idx, 1)" class="text-red-500 text-xs shrink-0 mb-1">Remove</button>
          </div>
        </div>
        <div class="flex gap-2 mb-4">
          <button @click="usItems.push({ raw_description: '', hs_code: '', declared_value_usd: 0 })" class="px-3 py-1 border rounded text-xs hover:bg-gray-100">+ Add Item</button>
          <button @click="doUsCompliance" :disabled="usChecking" class="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {{ usChecking ? 'Checking...' : 'Check' }}
          </button>
        </div>
        <p v-if="usError" class="text-red-500 text-sm mb-2">{{ usError }}</p>
        <div v-if="usCompResults.length" class="space-y-2">
          <div v-for="(r, idx) in usCompResults" :key="idx" class="border rounded overflow-hidden">
            <div class="px-3 py-2 flex justify-between items-center" :class="r.passed ? 'bg-green-50' : 'bg-red-50'">
              <div>
                <span class="font-medium text-sm">{{ r.raw_description }}</span>
                <span class="text-xs text-gray-500 ml-2">HS: {{ r.hs_code }} | ${{ r.declared_value_usd }}</span>
              </div>
              <span class="px-2 py-0.5 rounded text-xs font-medium" :class="r.passed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'">{{ r.passed ? 'PASS' : 'REVIEW' }}</span>
            </div>
            <div v-if="r.warnings?.length" class="px-3 py-2">
              <div v-for="(w, wi) in r.warnings" :key="wi" class="flex gap-2 py-0.5 text-sm">
                <span class="inline-block px-1 py-0 rounded text-xs font-medium shrink-0 mt-0.5" :class="wb(w.level)">{{ w.level }}</span>
                <span>{{ w.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- USA Acceptance Check (carrier weight/dim) -->
      <div class="bg-white rounded-lg shadow border p-4">
        <h2 class="text-lg font-semibold mb-3">US Acceptance Check (Carrier)</h2>
        <p class="text-xs text-gray-500 mb-3">Optional: check USPS/FedEx/UPS carrier limits by weight and dimensions.</p>
        <div v-for="(item, idx) in usAcceptItems" :key="idx" class="border rounded p-3 mb-2 bg-gray-50">
          <div class="flex gap-2 items-end">
            <div class="flex flex-col gap-1 w-24">
              <label class="text-xs text-gray-500">Weight (lbs)</label>
              <input v-model.number="item.weight_lbs" type="number" class="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div class="flex flex-col gap-1 w-20">
              <label class="text-xs text-gray-500">L (in)</label>
              <input v-model.number="item.length_in" type="number" class="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div class="flex flex-col gap-1 w-20">
              <label class="text-xs text-gray-500">W (in)</label>
              <input v-model.number="item.width_in" type="number" class="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div class="flex flex-col gap-1 w-20">
              <label class="text-xs text-gray-500">H (in)</label>
              <input v-model.number="item.height_in" type="number" class="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <button v-if="usAcceptItems.length > 1" @click="usAcceptItems.splice(idx, 1)" class="text-red-500 text-xs shrink-0 mb-1">Remove</button>
          </div>
        </div>
        <div class="flex gap-2">
          <button @click="usAcceptItems.push({ weight_lbs: undefined, length_in: undefined, width_in: undefined, height_in: undefined })" class="px-3 py-1 border rounded text-xs hover:bg-gray-100">+ Add Item</button>
          <button @click="doUsAcceptCheck" :disabled="usAcceptLoading" class="px-4 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 disabled:opacity-50">
            {{ usAcceptLoading ? 'Checking...' : 'Check Limits' }}
          </button>
        </div>
        <div v-if="usAcceptResults.length" class="mt-3 space-y-2">
          <div v-for="(r, idx) in usAcceptResults" :key="idx" class="border rounded p-2 text-sm" :class="r.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'">
            <div class="flex justify-between">
              <span class="font-medium">{{ r.weight_lbs }}lbs / {{ r.length_in }}"x{{ r.width_in }}"x{{ r.height_in }}"</span>
              <span :class="r.passed ? 'text-green-700' : 'text-red-700'">{{ r.passed ? 'Within Limits' : 'Over Limits' }}</span>
            </div>
            <div v-if="r.warnings?.length" class="mt-1">
              <div v-for="w in r.warnings" :key="w.check" class="text-xs text-yellow-700">{{ w.message }}</div>
            </div>
            <div v-if="r.carrier_restrictions" class="mt-1 text-xs text-gray-500">
              <div v-if="r.carrier_restrictions.usps?.length">USPS: {{ r.carrier_restrictions.usps[0] }}</div>
              <div v-if="r.carrier_restrictions.fedex?.length">FedEx: {{ r.carrier_restrictions.fedex[0] }}</div>
              <div v-if="r.carrier_restrictions.ups?.length">UPS: {{ r.carrier_restrictions.ups[0] }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import AppLayout from "../components/AppLayout.vue";
import { fetchComplianceCheck, fetchClassify, type ComplianceCheckItem, type ClassifyResponse } from "../api";
import api from "../api";

const country = ref("jp");

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
// --- USA ---
const usDesc = ref("");
const usHs = ref("");
const usLoading = ref(false);
const usResult = ref<any>(null);
const usError = ref("");

interface UsItem {
  raw_description: string;
  hs_code: string;
  declared_value_usd: number;
}

const usItems = reactive<UsItem[]>([
  { raw_description: "", hs_code: "", declared_value_usd: 0 },
]);
const usCompResults = ref<any[]>([]);
const usChecking = ref(false);

// Acceptance check
interface AcceptItem {
  weight_lbs?: number;
  length_in?: number;
  width_in?: number;
  height_in?: number;
}
const usAcceptItems = reactive<AcceptItem[]>([
  { weight_lbs: undefined, length_in: undefined, width_in: undefined, height_in: undefined },
]);
const usAcceptResults = ref<any[]>([]);
const usAcceptLoading = ref(false);

async function doUsClassify() {
  if (!usDesc.value.trim()) return;
  usLoading.value = true; usResult.value = null; usError.value = "";
  try {
    const body: any = { raw_description: usDesc.value.trim() };
    if (usHs.value.trim()) body.hs_code = usHs.value.trim();
    const res = await api.post("/us/classify", body);
    usResult.value = res.data;
  } catch (e: any) {
    usError.value = e?.response?.data?.message || e?.message || "Failed";
  }
  usLoading.value = false;
}

async function doUsCompliance() {
  const valid = usItems.filter((i) => i.raw_description.trim() && i.hs_code.trim() && i.declared_value_usd > 0);
  if (valid.length === 0) { usError.value = "Fill at least one item"; return; }
  usChecking.value = true; usError.value = "";
  try {
    const res = await api.post("/us/compliance/check", { items: valid });
    usCompResults.value = res.data.results;
  } catch (e: any) {
    usError.value = e?.response?.data?.message || e?.message || "Check failed";
  }
  usChecking.value = false;
}

async function doUsAcceptCheck() {
  const valid = usAcceptItems.filter((i) => i.weight_lbs && i.length_in && i.width_in && i.height_in);
  if (valid.length === 0) { usError.value = "Fill weight and dimensions for at least one item"; return; }
  usAcceptLoading.value = true;
  try {
    const res = await api.post("/us/compliance/check", {
      items: valid.map(i => ({
        raw_description: "Package",
        hs_code: "00000000",
        declared_value_usd: 1,
        weight_lbs: i.weight_lbs,
        length_in: i.length_in,
        width_in: i.width_in,
        height_in: i.height_in,
      }))
    });
    usAcceptResults.value = res.data.results.map((r: any) => ({
      ...r,
      weight_lbs: valid[0]?.weight_lbs,
      length_in: valid[0]?.length_in,
      width_in: valid[0]?.width_in,
      height_in: valid[0]?.height_in,
    }));
  } catch (e: any) {
    usError.value = e?.response?.data?.message || e?.message || "Check failed";
  }
  usAcceptLoading.value = false;
}
</script>
