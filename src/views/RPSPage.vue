<template>
  <div class="page-container">
    <header class="page-header">
      <h1>
        <i class="fas fa-hand-rock"></i><i class="fas fa-hand-paper"></i
        ><i class="fas fa-hand-scissors"></i> 가위바위보
      </h1>
      <p class="description">
        SaltMate를 걸고 컴퓨터와 가위바위보 대결을 펼치세요!
      </p>
    </header>

    <div class="game-card card">
      <div v-if="result" class="result-display" :class="result.result">
        <div class="choices">
          <div class="choice">
            <strong>나:</strong>
            <i :class="`fas fa-hand-${result.userChoice}`"></i>
          </div>
          <div class="choice">
            <strong>컴퓨터:</strong>
            <i :class="`fas fa-hand-${result.computerChoice}`"></i>
          </div>
        </div>
        <p class="result-message">{{ resultText }}</p>
      </div>

      <div v-else class="initial-display">
        <p>
          승리 시 <strong>{{ gameSettings.rpsMultiplier }}배</strong>, 무승부 시
          <strong>베팅 금액을 반환</strong>합니다.
        </p>
      </div>

      <div class="betting-controls">
        <input
          type="number"
          v-model.number="betAmount"
          placeholder="베팅할 SaltMate"
          min="1"
        />
        <div class="buttons">
          <button @click="play('rock')" :disabled="isLoading">
            <i class="fas fa-hand-rock"></i>
          </button>
          <button @click="play('scissors')" :disabled="isLoading">
            <i class="fas fa-hand-scissors"></i>
          </button>
          <button @click="play('paper')" :disabled="isLoading">
            <i class="fas fa-hand-paper"></i>
          </button>
        </div>
      </div>
      <div v-if="isLoading" class="loading-overlay">
        <div class="spinner-large"></div>
        <p>결과를 기다리는 중...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "@/firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";

const betAmount = ref(100);
const isLoading = ref(false);
const result = ref(null);
const gameSettings = reactive({
  rpsMultiplier: 1.2,
});

let unsubscribe = null; 

onMounted(() => {
  const configRef = doc(db, "configuration", "gameSettings");
  unsubscribe = onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      gameSettings.rpsMultiplier = docSnap.data().rpsMultiplier || 1.2;
    }
  });
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

const resultText = computed(() => {
  if (!result.value) return "";
  switch (result.value.result) {
    case "win":
      return `승리! ${result.value.winnings.toLocaleString()} SaltMate 획득!`;
    case "lose":
      return "패배...";
    case "draw":
      return "무승부! 베팅 금액을 돌려받습니다.";
    default:
      return "";
  }
});

const play = async (choice) => {
  if (betAmount.value <= 0) {
    alert("베팅 금액을 1 이상 입력해주세요.");
    return;
  }

  isLoading.value = true;
  result.value = null;

  try {
    const functions = getFunctions();
    const playRPS = httpsCallable(functions, "playRPS");
    const response = await playRPS({ betAmount: betAmount.value, choice });
    result.value = response.data;
  } catch (error) {
    console.error("가위바위보 게임 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.page-container {
  max-width: 600px;
  margin: 90px auto 20px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 20px;
}
.page-header h1 {
  font-size: 2em;
}
.game-card {
  padding: 30px;
  text-align: center;
  position: relative;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
}
.result-display {
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  animation: fadeIn 0.5s;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
.result-display.win {
  background-color: #d4edda;
  color: #155724;
}
.result-display.lose {
  background-color: #f8d7da;
  color: #721c24;
}
.result-display.draw {
  background-color: #fff3cd;
  color: #856404;
}
.choices {
  font-size: 3em;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-around;
  align-items: center;
}
.result-message {
  font-weight: bold;
  font-size: 1.3em;
  margin: 0;
}
.initial-display p {
  color: #666;
  font-size: 1.1em;
}
.betting-controls input {
  width: 100%;
  padding: 12px;
  font-size: 1.2em;
  text-align: center;
  border: 2px solid #ccc;
  border-radius: 8px;
  margin-bottom: 20px;
  transition: border-color 0.2s;
}
.betting-controls input:focus {
  border-color: #007bff;
  outline: none;
}
.buttons {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
.buttons button {
  padding: 20px;
  font-size: 3.5em;
  border: none;
  border-radius: 50%;
  width: 120px;
  height: 120px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: #f8f9fa;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  line-height: 1;
}
.buttons button:hover:not(:disabled) {
  transform: translateY(-5px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
}
.buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.loading-overlay {
  position: absolute;
  inset: 0;
  background-color: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 12px;
}
.spinner-large {
  border: 5px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  animation: spin 1s linear infinite;
}
.loading-overlay p {
  margin-top: 20px;
  font-size: 1.2em;
  color: #333;
  font-weight: bold;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>