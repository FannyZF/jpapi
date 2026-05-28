<template>
  <div class="min-h-screen bg-gray-100 flex items-center justify-center">
    <div class="bg-white rounded-lg shadow-lg p-8 w-96">
      <h1 class="text-xl font-bold mb-2">Customs API Hub</h1>
      <p class="text-sm text-gray-500 mb-6">请输入 Admin API Key 进入管理后台</p>
      <div class="space-y-4">
        <div>
          <input
            v-model="apiKey"
            type="password"
            class="w-full border rounded px-4 py-2.5 text-sm font-mono"
            placeholder="ch_xxxxxxxxxxxxxxxx"
            @keyup.enter="login"
            autofocus
          />
        </div>
        <button
          @click="login"
          :disabled="!apiKey.trim()"
          class="w-full py-2.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          进入系统
        </button>
        <p v-if="error" class="text-red-500 text-sm text-center">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import api, { setSessionKey, hasSessionKey } from "../api";

const router = useRouter();
const route = useRoute();
const apiKey = ref("");
const error = ref("");

onMounted(async () => {
  if (hasSessionKey()) {
    router.push("/");
    return;
  }
  const urlKey = (route.query.key as string) || "";
  if (urlKey) {
    apiKey.value = urlKey;
    await login();
  }
});

async function login() {
  if (!apiKey.value.trim()) return;
  error.value = "";
  try {
    await api.get("/health", {
      headers: { "X-API-Key": apiKey.value.trim() },
    });
    setSessionKey(apiKey.value.trim());
    router.push("/");
  } catch {
    error.value = "API Key 无效，请重试";
  }
}
</script>
