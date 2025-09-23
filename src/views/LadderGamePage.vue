<template>
  <div class="ladder-game-page">
    <div class="game-container">
      <header class="game-header">
        <h1>사다리타기 게임</h1>
        <p>참가비를 내고 운명의 사다리를 타보세요! 결과는 신도 모릅니다.</p>
      </header>
      
      <div v-if="!gameStarted" class="setup-controls">
        <div class="entry-selector">
          <button v-for="n in 5" :key="n" @click="entryCount = n" :class="{active: entryCount === n}">
            {{ n }}회 참여
          </button>
        </div>
        <p class="cost-info">참가비: {{ entryCount * 100 }} SaltMate</p>
        <button class="start-button" @click="startGame" :disabled="isLoading">
          <span v-if="isLoading" class="spinner-small"></span>
          <span v-else>결과 확인하기</span>
        </button>
      </div>

      <div v-if="gameStarted && results.length > 0" class="results-display">
        <h3>게임 결과</h3>
        <ul class="results-list">
          <li v-for="(result, index) in results" :key="index" class="result-item">
            <span>{{ index + 1 }}번째 사다리:</span>
            <strong :class="{win: result.prize > 0}">{{ result.prize.toLocaleString() }} SaltMate 획득</strong>
          </li>
        </ul>
        <div class="summary">
          <p>총 획득: <span class="win">{{ totalWinnings.toLocaleString() }} SaltMate</span></p>
          <p>총 참가비: <span>- {{ (entryCount * 100).toLocaleString() }} SaltMate</span></p>
          <hr/>
          <p>최종 손익: 
            <strong :class="netGain >= 0 ? 'win' : 'lose'">
              {{ netGain >= 0 ? '+' : '' }}{{ netGain.toLocaleString() }} SaltMate
            </strong>
          </p>
        </div>
        <button class="start-button" @click="resetGame">다시하기</button>
      </div>

      <div v-if="error" class="error-message">
        <p>{{ error }}</p>
        <button class="start-button" @click="resetGame">다시 시도</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const entryCount = ref(1);
const isLoading = ref(false);
const gameStarted = ref(false);
const results = ref([]);
const error = ref(null);

const totalWinnings = computed(() => results.value.reduce((sum, r) => sum + r.prize, 0));
const netGain = computed(() => totalWinnings.value - (entryCount.value * 100));

const startGame = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const playLadderGame = httpsCallable(functions, 'playLadderGame');
    const response = await playLadderGame({ entryCount: entryCount.value });
    results.value = response.data.results;
    gameStarted.value = true;
  } catch (err) {
    console.error("사다리타기 게임 오류:", err);
    error.value = err.message || "게임 플레이 중 오류가 발생했습니다.";
  } finally {
    isLoading.value = false;
  }
};

const resetGame = () => {
  gameStarted.value = false;
  results.value = [];
  error.value = null;
  entryCount.value = 1;
};
</script>

<style scoped>
.ladder-game-page { padding: 20px; background-color: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
.game-container { background: white; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 30px; width: 100%; max-width: 500px; text-align: center; }
.game-header h1 { margin: 0 0 10px; font-size: 2em; }
.game-header p { margin: 0 0 30px; color: #666; }
.setup-controls, .results-display { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.entry-selector { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.entry-selector button { padding: 10px 15px; border: 2px solid #ddd; background: #f9f9f9; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.2s; }
.entry-selector button.active { border-color: #007bff; background: #007bff; color: white; }
.cost-info { font-weight: bold; color: #333; }
.start-button { background-color: #28a745; color: white; padding: 12px 30px; border: none; border-radius: 8px; font-size: 1.1em; font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
.start-button:disabled { background-color: #aaa; }
.results-list { list-style: none; padding: 0; width: 100%; }
.result-item { display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 6px; margin-bottom: 8px; }
.summary { width: 100%; border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px; }
.summary p { margin: 5px 0; display: flex; justify-content: space-between; font-size: 1.1em; }
.win { color: #28a745; }
.lose { color: #dc3545; }
.error-message { color: #dc3545; margin-top: 20px; }
.spinner-small { border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>