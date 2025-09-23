<template>
  <div class="gacha-page">
    <header class="page-header">
      <h1>오늘의 소금 항아리</h1>
      <p>항아리를 열어 대박 SaltMate를 노려보세요! 하루에 한 번만 가능합니다.</p>
    </header>

    <div class="pots-container">
      <div v-for="pot in pots" :key="pot.type" class="pot-card" :class="pot.type">
        <h3>{{ pot.name }}</h3>
        <div class="pot-icon">{{ pot.icon }}</div>
        <p class="pot-description">{{ pot.description }}</p>
        <p class="pot-cost">참가비: {{ pot.cost.toLocaleString() }} SaltMate</p>
        <button @click="openPot(pot.type)" :disabled="isLoading || gamePlayed">
          {{ gamePlayed ? '내일 다시' : '열기' }}
        </button>
      </div>
    </div>

    <div v-if="resultModal.visible" class="modal-overlay" @click="resultModal.visible = false">
      <div class="modal-content">
        <div v-if="isLoading" class="spinner"></div>
        <div v-if="resultModal.prize">
          <h2>🎉 당첨! 🎉</h2>
          <p class="prize-amount">{{ resultModal.prize.amount.toLocaleString() }} SaltMate</p>
          <p>를 획득하셨습니다!</p>
          <button @click="resultModal.visible = false">확인</button>
        </div>
        <div v-if="resultModal.error">
          <h2>오류</h2>
          <p>{{ resultModal.error }}</p>
          <button @click="resultModal.visible = false">닫기</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const pots = ref([
  { type: 'normal', name: '일반 항아리', icon: '🏺', description: '작지만 소소한 행운이!', cost: 100 },
  { type: 'premium', name: '고급 항아리', icon: '🌟', description: '조금 더 큰 행운을 기대해보세요.', cost: 500 },
  { type: 'rare', name: '희귀 항아리', icon: '💎', description: '엄청난 행운이 당신을 기다립니다!', cost: 2000 },
]);
const isLoading = ref(false);
const gamePlayed = ref(false);
const resultModal = reactive({
  visible: false,
  prize: null,
  error: null
});

const openPot = async (potType) => {
  isLoading.value = true;
  resultModal.visible = true;
  resultModal.prize = null;
  resultModal.error = null;

  try {
    const openSaltPot = httpsCallable(functions, 'openSaltPot');
    const response = await openSaltPot({ potType });
    resultModal.prize = response.data.prize;
    gamePlayed.value = true; // 게임 성공 시 플레이 완료 처리
  } catch (err) {
    console.error("항아리 열기 오류:", err);
    resultModal.error = err.message || "항아리를 여는 중 오류가 발생했습니다.";
    if (err.code && err.message.includes('하루에 한 번만')) {
        gamePlayed.value = true;
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.gacha-page { padding: 20px; text-align: center; }
.page-header { margin-bottom: 40px; }
.page-header h1 { font-size: 2.5em; }
.page-header p { font-size: 1.2em; color: #555; }
.pots-container { display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; }
.pot-card { border: 2px solid #ddd; border-radius: 16px; padding: 25px; width: 300px; transition: all 0.3s; }
.pot-card:hover { transform: translateY(-10px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
.pot-card.normal { border-color: #cd7f32; }
.pot-card.premium { border-color: #c0c0c0; }
.pot-card.rare { border-color: #ffd700; }
.pot-icon { font-size: 4em; margin: 15px 0; }
.pot-description { color: #777; min-height: 40px; }
.pot-cost { font-weight: bold; font-size: 1.1em; }
.pot-card button { width: 100%; padding: 12px; font-size: 1.1em; font-weight: bold; color: white; border: none; border-radius: 8px; cursor: pointer; transition: background-color 0.2s; }
.pot-card.normal button { background-color: #cd7f32; }
.pot-card.premium button { background-color: #8395a7; }
.pot-card.rare button { background-color: #f9ca24; color: #333; }
.pot-card button:disabled { background-color: #aaa; }
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 40px; border-radius: 12px; text-align: center; }
.prize-amount { font-size: 2.5em; font-weight: bold; color: #007bff; margin: 10px 0; }
.spinner { border: 5px solid rgba(0,0,0,0.1); border-top-color: #007bff; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>