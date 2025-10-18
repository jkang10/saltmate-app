<template>
  <div class="page-container">
    <div class="card">
      <h2>쿠폰 / 코드 등록</h2>
      <p>관리자에게 받은 보상 코드를 입력해주세요.</p>
      <div class="input-group">
        <input type="text" v-model="code" placeholder="예: ABC-DEF-GHI" @keyup.enter="claim" />
        <button @click="claim" :disabled="isLoading">
          {{ isLoading ? '등록 중...' : '등록하기' }}
        </button>
      </div>
      <p v-if="message" :class="isError ? 'error-msg' : 'success-msg'">{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebaseConfig';

const code = ref('');
const isLoading = ref(false);
const message = ref('');
const isError = ref(false);

const claim = async () => {
  if (!code.value) {
    isError.value = true;
    message.value = '코드를 입력해주세요.';
    return;
  }
  isLoading.value = true;
  message.value = '';
  isError.value = false;

  try {
    const claimFunc = httpsCallable(functions, 'claimRewardCode');
    const result = await claimFunc({ code: code.value });
    message.value = result.data.message;
  } catch (error) {
    isError.value = true;
    message.value = error.message;
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.page-container { max-width: 600px; margin: 90px auto 20px; padding: 20px; }
.card { background: white; padding: 30px; border-radius: 15px; box-shadow: 0 8px 25px rgba(0,0,0,0.08); text-align: center; }
.input-group { display: flex; gap: 10px; margin: 20px 0; }
input { flex-grow: 1; padding: 12px; border-radius: 8px; border: 1px solid #ccc; font-size: 1.1em; }
.success-msg { color: #28a745; }
.error-msg { color: #dc3545; }
</style>