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
      <div v-if="remainingPlays !== null" class="play-count">
        오늘 남은 횟수: <strong>{{ remainingPlays }}</strong> / {{ gameSettings.highLowLimit }}
      </div>

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
        <p>
          성공 시 베팅 금액의
          <strong>{{ gameSettings.highLowMultiplier }}배</strong>를 획득합니다.
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
import { ref, reactive, onMounted, onUnmounted } from "vue"; // [수정] onUnmounted 추가
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, auth } from "@/firebaseConfig";
import { doc, onSnapshot, getDoc } from "firebase/firestore";

const betAmount = ref(100);
const isLoading = ref(false);
const result = ref(null);
const choice = ref("");
const gameSettings = reactive({
  highLowMultiplier: 1.2,
  highLowLimit: 10,
});
const remainingPlays = ref(null);

let unsubscribe = null; // [수정] 리스너 정리 함수를 저장할 변수

const fetchPlayCount = async () => {
  const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const playCountRef = doc(db, "users", auth.currentUser.uid, "daily_play_counts", todayStr);
  const docSnap = await getDoc(playCountRef);
  
  const playCount = docSnap.exists() ? (docSnap.data().highLow || 0) : 0;
  remainingPlays.value = gameSettings.highLowLimit - playCount;
};

onMounted(() => {
  const configRef = doc(db, "configuration", "gameSettings");
  // [수정] unsubscribe 변수에 리스너 정리 함수를 할당
  unsubscribe = onSnapshot(configRef, (docSnap) => {
    if (docSnap.exists()) {
      gameSettings.highLowMultiplier = docSnap.data().highLowMultiplier || 1.2;
      gameSettings.highLowLimit = docSnap.data().highLowLimit || 10;
      if (auth.currentUser) {
        fetchPlayCount();
      }
    }
  });
});

// [추가] 컴포넌트가 사라질 때 리스너를 정리하여 메모리 누수 방지
onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

const play = async (playerChoice) => {
  if (betAmount.value <= 0) {
    alert("베팅 금액을 1 이상 입력해주세요.");
    return;
  }

  isLoading.value = true;
  choice.value = playerChoice;
  result.value = null;

  try {
    const functions = getFunctions();
    const playHighLow = httpsCallable(functions, "playHighLow");
    const response = await playHighLow({
      betAmount: betAmount.value,
      choice: playerChoice,
    });
    result.value = response.data;
    remainingPlays.value = response.data.remainingPlays;
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
.play-count {
  margin-bottom: 15px;
  font-size: 1.1em;
  color: #333;
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 8px;
}
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
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.result-display.win {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}
.result-display.lose {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
.numbers {
  font-size: 2em;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  font-weight: bold;
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
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.buttons button {
  padding: 15px;
  font-size: 1.5em;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
.btn-high {
  background: linear-gradient(135deg, #ff7e5f, #feb47b);
  color: white;
}
.btn-low {
  background: linear-gradient(135deg, #007bff, #00c6ff);
  color: white;
}
.buttons button:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}
.buttons button:disabled {
  background: #e9ecef;
  color: #adb5bd;
  box-shadow: none;
}
.spinner-small {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>