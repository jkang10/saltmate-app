<template>
  <div class="page-container">
    <header class="page-header">
      <h1>
        <i class="fas fa-arrow-up"></i
        ><i class="fas fa-arrow-down"></i> 하이로우 게임
      </h1>
      <p class="description">
        제시된 숫자보다 다음 숫자가 높을지 낮을지 예측하세요!
      </p>
    </header>

    <div class="game-card card">
      <div
        v-if="result"
        class="result-display"
        :class="result.isWin ? 'win' : 'lose'"
      >
        <div class="numbers">
          <span
            >기존 숫자: <strong>{{ result.baseNumber }}</strong></span
          >
          <i class="fas fa-long-arrow-alt-right"></i>
          <span
            >다음 숫자: <strong>{{ result.nextNumber }}</strong></span
          >
        </div>
        <p class="result-message">
          {{
            result.isWin
              ? `성공! ${result.winnings.toLocaleString()} SaltMate 획득!`
              : "실패..."
          }}
        </p>
      </div>

      <div v-else class="initial-display">
        <p>1부터 100 사이의 숫자가 무작위로 선택됩니다.</p>
        <p>성공 시 베팅 금액의 <strong>1.8배</strong>를 획득합니다.</p>
      </div>

      <div class="betting-controls">
        <input
          type="number"
          v-model.number="betAmount"
          placeholder="베팅할 SaltMate"
          min="1"
        />
        <div class="buttons">
          <button
            @click="play('high')"
            :disabled="isLoading || betAmount <= 0"
            class="btn-high"
          >
            <span
              v-if="isLoading && choice === 'high'"
              class="spinner-small"
            ></span>
            <span v-else>HIGH <i class="fas fa-angle-double-up"></i></span>
          </button>
          <button
            @click="play('low')"
            :disabled="isLoading || betAmount <= 0"
            class="btn-low"
          >
            <span
              v-if="isLoading && choice === 'low'"
              class="spinner-small"
            ></span>
            <span v-else>LOW <i class="fas fa-angle-double-down"></i></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { getFunctions, httpsCallable } from "firebase/functions";

const betAmount = ref(100);
const isLoading = ref(false);
const result = ref(null);
const choice = ref("");

const play = async (playerChoice) => {
  if (betAmount.value <= 0) {
    alert("베팅 금액을 1 이상 입력해주세요.");
    return;
  }

  isLoading.value = true;
  choice.value = playerChoice;
  result.value = null; // 이전 결과 초기화

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const playHighLow = httpsCallable(functions, "playHighLow");
    const response = await playHighLow({
      betAmount: betAmount.value,
      choice: playerChoice,
    });
    result.value = response.data;
  } catch (error) {
    console.error("하이로우 게임 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isLoading.value = false;
    choice.value = "";
  }
};
</script>

<style scoped>
/* (스타일은 아래 2단계 파일과 공통으로 사용됩니다) */
.page-container {
  max-width: 600px;
  margin: 90px auto 20px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 20px;
}
.game-card {
  padding: 30px;
  text-align: center;
}
.result-display {
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.result-display.win {
  background-color: #d4edda;
  color: #155724;
}
.result-display.lose {
  background-color: #f8d7da;
  color: #721c24;
}
.numbers {
  font-size: 1.5em;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
}
.result-message {
  font-weight: bold;
  font-size: 1.2em;
  margin: 0;
}
.initial-display p {
  color: #666;
}
.betting-controls input {
  width: 100%;
  padding: 12px;
  font-size: 1.2em;
  text-align: center;
  border: 1px solid #ccc;
  border-radius: 8px;
  margin-bottom: 20px;
}
.buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.buttons button {
  padding: 15px;
  font-size: 1.2em;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-high {
  background-color: #dc3545;
  color: white;
}
.btn-low {
  background-color: #007bff;
  color: white;
}
.buttons button:disabled {
  background-color: #ccc;
}
.spinner-small {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
