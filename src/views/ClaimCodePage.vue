<template>
  <div class="claim-code-page-container">
    <div class="card glassmorphism">
      <div class="card-header">
        <i class="fas fa-ticket-alt title-icon"></i>
        <h2 class="title">쿠폰 / 코드 등록</h2>
        <p class="description">이벤트로 지급받은 코드를 입력하거나, 내게 발급된 코드를 확인하고 사용하세요.</p>
      </div>

      <div class="card-body">
        <div class="input-section">
          <h3>범용 코드 입력</h3>
          <div class="input-group">
            <input type="text" v-model="code" placeholder="예: ABC-DEF-GHI" @keyup.enter="claim" />
            <button @click="claim" :disabled="isLoading" class="action-button">
              {{ isLoading ? '등록 중...' : '등록하기' }}
            </button>
          </div>
          <p v-if="message" :class="isError ? 'error-msg' : 'success-msg'">{{ message }}</p>
        </div>

        <div class="my-codes-section">
          <h3><i class="fas fa-envelope-open-text"></i> 내 보상 코드함</h3>
          <div v-if="codesLoading" class="loading-spinner"></div>
          <div v-else-if="myCodes.length === 0" class="no-codes">
            <p>현재 발급된 보상 코드가 없습니다.</p>
          </div>
          <ul v-else class="code-list">
            <li v-for="c in myCodes" :key="c.code" class="code-item">
              <div class="code-info">
                <span class="code-text">{{ c.code }}</span>
                <span class="code-desc">{{ c.description }}</span>
              </div>
              <button @click="claim(c.code)" class="action-button use-button">사용하기</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebaseConfig';

const code = ref('');
const isLoading = ref(false);
const message = ref('');
const isError = ref(false);

const myCodes = ref([]);
const codesLoading = ref(true);

const fetchMyCodes = async () => {
  codesLoading.value = true;
  try {
    const getCodesFunc = httpsCallable(functions, 'getMyRewardCodes');
    const result = await getCodesFunc();
    myCodes.value = result.data.codes;
  } catch (error) {
    console.error("내 코드함 조회 실패:", error);
  } finally {
    codesLoading.value = false;
  }
};

const claim = async (codeToClaim) => {
  const targetCode = codeToClaim || code.value;
  if (!targetCode) {
    isError.value = true;
    message.value = '코드를 입력해주세요.';
    return;
  }
  isLoading.value = true;
  message.value = '';
  isError.value = false;

  try {
    const claimFunc = httpsCallable(functions, 'claimRewardCode');
    const result = await claimFunc({ code: targetCode });
    message.value = `✅ ${result.data.message}`;
    code.value = ''; // 입력창 비우기
    fetchMyCodes(); // 코드 목록 갱신
  } catch (error) {
    isError.value = true;
    message.value = `❌ ${error.message}`;
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchMyCodes();
});
</script>

<style scoped>
.claim-code-page-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px);
  padding: 20px;
  background: linear-gradient(135deg, #2c3e50, #34495e);
}
.card.glassmorphism {
  width: 100%;
  max-width: 600px;
  padding: 40px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
  text-align: center;
  color: #ecf0f1;
}
.card-header {
  margin-bottom: 40px;
}
.title-icon { font-size: 3em; color: #f1c40f; margin-bottom: 15px; text-shadow: 0 0 15px #f1c40f; }
.title { font-size: 2.5em; font-weight: 700; margin-bottom: 10px; }
.description { font-size: 1.1em; color: #bdc3c7; }
.input-section {
  margin-bottom: 40px;
}
h3 {
  font-size: 1.5em;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.input-group { display: flex; gap: 10px; margin: 20px 0; }
input {
  flex-grow: 1;
  padding: 15px;
  font-size: 1.1em;
  border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.2);
  background-color: transparent;
  color: white;
}
input:focus { outline: none; border-color: #f1c40f; }
.action-button {
  padding: 15px 25px;
  font-size: 1em;
  font-weight: bold;
  cursor: pointer;
  border-radius: 8px;
  border: none;
  background: linear-gradient(145deg, #f1c40f, #e67e22);
  color: white;
  transition: all 0.3s ease;
}
.action-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
.success-msg, .error-msg { font-weight: bold; margin-top: 15px; }
.success-msg { color: #2ecc71; }
.error-msg { color: #e74c3c; }
.no-codes { padding: 20px; color: #95a5a6; }
.code-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
.code-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: rgba(255,255,255,0.05);
  border-radius: 10px;
  transition: background-color 0.2s;
}
.code-item:hover { background-color: rgba(255,255,255,0.1); }
.code-info { text-align: left; }
.code-text { display: block; font-size: 1.2em; font-weight: bold; font-family: monospace; }
.code-desc { font-size: 0.9em; color: #bdc3c7; }
.use-button { padding: 10px 15px; font-size: 0.9em; }
</style>