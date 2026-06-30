<template>
  <AppLayout>
    <h1 class="text-2xl font-bold mb-6">Japan Post 地址校验</h1>
    <p class="text-sm text-gray-500 mb-6">通过日本邮政官方 API 校验收件地址与邮编是否匹配，并返回正确的邮便番号。</p>

    <div class="bg-white rounded-lg shadow border p-6 max-w-2xl">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">收件地址</label>
          <input
            v-model="address"
            type="text"
            class="w-full border rounded px-3 py-2 text-sm"
            placeholder="例: 東京都新宿区西新宿2-8-1"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">邮便番号</label>
          <input
            v-model="zipcode"
            type="text"
            class="w-full border rounded px-3 py-2 text-sm font-mono"
            placeholder="例: 160-0023"
          />
        </div>
        <button
          @click="doValidate"
          :disabled="loading || !address.trim() || !zipcode.trim()"
          class="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {{ loading ? '校验中...' : '校验' }}
        </button>
        <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
      </div>

      <div v-if="result" class="mt-6 border-t pt-4 space-y-3">
        <!-- Match Status -->
        <div :class="result.matched ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'" class="border rounded p-3">
          <span class="font-bold text-sm" :class="result.matched ? 'text-green-700' : 'text-red-700'">
            {{ result.matched ? '✓ 匹配' : '✗ 不匹配' }}
          </span>
          <p class="text-sm mt-1" :class="result.matched ? 'text-green-600' : 'text-red-600'">{{ result.message }}</p>
        </div>

        <!-- Official Address -->
        <div v-if="result.address" class="bg-gray-50 border rounded p-3">
          <h3 class="text-sm font-semibold text-gray-700 mb-2">邮便番号 {{ result.input_zipcode }} 对应的官方地址</h3>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-gray-500">
                <th class="py-1 pr-4"></th>
                <th class="py-1 pr-4">汉字</th>
                <th class="py-1 pr-4">カナ</th>
                <th class="py-1">ローマ字</th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b">
                <td class="py-1 text-gray-500">都道府県</td>
                <td class="py-1 font-medium">{{ result.address.prefecture }}</td>
                <td class="py-1">{{ result.address.prefecture_kana }}</td>
                <td class="py-1 text-xs">{{ result.address.prefecture_romaji }}</td>
              </tr>
              <tr class="border-b">
                <td class="py-1 text-gray-500">市区町村</td>
                <td class="py-1 font-medium">{{ result.address.city }}</td>
                <td class="py-1">{{ result.address.city_kana }}</td>
                <td class="py-1 text-xs">{{ result.address.city_romaji }}</td>
              </tr>
              <tr>
                <td class="py-1 text-gray-500">町域</td>
                <td class="py-1 font-medium">{{ result.address.town }}</td>
                <td class="py-1">{{ result.address.town_kana }}</td>
                <td class="py-1 text-xs">{{ result.address.town_romaji }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Suggested Zipcode -->
        <div v-if="result.suggested_zipcode" class="bg-yellow-50 border border-yellow-200 rounded p-3">
          <span class="text-sm font-bold text-yellow-700">建议正确邮编: </span>
          <code class="text-lg font-mono font-bold text-yellow-800">{{ formatZip(result.suggested_zipcode) }}</code>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import AppLayout from "../components/AppLayout.vue";
import api from "../api";

const address = ref("");
const zipcode = ref("");
const loading = ref(false);
const error = ref("");
const result = ref<any>(null);

function formatZip(zip: string): string {
  const cleaned = zip.replace(/[^\d]/g, "");
  if (cleaned.length === 7) return cleaned.slice(0, 3) + "-" + cleaned.slice(3);
  return zip;
}

async function doValidate() {
  loading.value = true;
  error.value = "";
  result.value = null;
  try {
    const res = await api.post("/jp/post/validate", {
      raw_address: address.value.trim(),
      provided_zipcode: zipcode.value.trim(),
    });
    result.value = res.data.data;
  } catch (e: any) {
    error.value = e?.response?.data?.message || "校验失败";
  }
  loading.value = false;
}
</script>
