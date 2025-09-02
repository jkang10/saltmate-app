<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-gem"></i> 소금 결정 키우기</h1>
      <p>소금 결정을 클릭해서 SaltMate 포인트를 수확하세요!</p>
    </header>

    <div class="game-card card">
      <div class="play-count">
        오늘 남은 횟수: <strong>{{ remainingPlays }}</strong> / {{ maxPlaysToday }}
      </div>

      <div class="crystal-container" @click="handleClick" :class="{ harvestable: isHarvestable }">
        <img
          src="@/assets/crystal.png"
          alt="소금 결정"
          class="crystal-image"
          :style="{ transform: `scale(${1 + score / 2000})` }"
        />
        <div
          v-for="i in floatingNumbers"
          :key="i.id"
          class="floating-number"
          :style="{ top: i.y + 'px', left: i.x + 'px' }"
        >
          +1
        </div>
      </div>

      <div class="score-progress">
        <span class="score-text"
          >현재 점수: {{ score.toLocaleString() }} /
          {{ scoreGoal.toLocaleString() }}</span
        >
        <div class="progress-bar">
          <div
            class="progress-bar-inner"
            :style="{ width: progressBarWidth }"
          ></div>
        </div>
      </div>

      <button
        class="harvest-button"
        @click="harvest"
        :disabled="isHarvesting || !isHarvestable || remainingPlays <= 0"
      >
        <span v-if="isHarvesting" class="spinner-small"></span>
        <span v-else-if="remainingPlays <= 0">오늘 모두 수확했어요!</span>
        <span v-else
          >수확하기 ({{
            Math.floor(score / 10).toLocaleString()
          }}P
          획득)</span
        >
      </button>
       <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
       <p v-if="error" class="error-message">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { db, auth } from "@/firebaseConfig";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

// --- 상태 변수 ---
const score = ref(0);
const scoreGoal = ref(1000);
const isHarvesting = ref(false);
const floatingNumbers = ref([]);
const userData = ref({ saltGameData: { date: "", count: 0 } });
const error = ref("");
const successMessage = ref("");

let userDataUnsubscribe = null;

// --- 계산된 속성 ---
const playLimits = [1, 1, 2, 1, 2, 1, 2]; // 일, 월, 화, 수, 목, 금, 토

const maxPlaysToday = computed(() => {
  const dayOfWeek = new Date().getDay();
  return playLimits[dayOfWeek];
});

const remainingPlays = computed(() => {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (userData.value.saltGameData.date === todayStr) {
    return maxPlaysToday.value - userData.value.saltGameData.count;
  }
  return maxPlaysToday.value;
});

const isHarvestable = computed(() => score.value >= scoreGoal.value);

const progressBarWidth = computed(() => {
  const percentage = (score.value / scoreGoal.value) * 100;
  return `${Math.min(percentage, 100)}%`;
});


// --- 함수 ---
const getGameStatus = async () => {
  if (!auth.currentUser) return;
  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().saltGameData) {
      userData.value.saltGameData = userSnap.data().saltGameData;
    }
  } catch (err) {
    console.error("게임 상태 조회 오류:", err);
    error.value = "게임 상태를 불러오는 데 실패했습니다.";
  }
};


const handleClick = (event) => {
  if (isHarvestable.value || remainingPlays.value <= 0) return;
  score.value += 1;

  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const newNumber = { id: Date.now(), x, y };
  floatingNumbers.value.push(newNumber);
  setTimeout(() => {
    floatingNumbers.value = floatingNumbers.value.filter(
      (n) => n.id !== newNumber.id,
    );
  }, 1000);
};

const harvest = async () => {
  if (!isHarvestable.value || isHarvesting.value || remainingPlays.value <= 0) return;

  isHarvesting.value = true;
  error.value = "";
  successMessage.value = "";

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const harvestSaltCrystals = httpsCallable(functions, "harvestSaltCrystals");
    const result = await harvestSaltCrystals({ clicks: score.value });

    const awarded = result.data.awardedPoints;
    successMessage.value = `성공! ${awarded.toLocaleString()} SaltMate 포인트를 수확했습니다!`;
    score.value = 0;
    await getGameStatus();

    setTimeout(() => (successMessage.value = ""), 3000);
  } catch (err) {
    console.error("수확 오류:", err);
    error.value = `수확 실패: ${err.message}`;
    if (err.code?.includes("resource-exhausted")) {
      await getGameStatus();
    }
  } finally {
    isHarvesting.value = false;
  }
};

onMounted(() => {
  if (auth.currentUser) {
    const userRef = doc(db, "users", auth.currentUser.uid);
    // onSnapshot은 실시간으로 데이터를 감지하므로, getGameStatus 대신 사용
    userDataUnsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().saltGameData) {
        userData.value.saltGameData = docSnap.data().saltGameData;
      }
    });
  }
});

onUnmounted(() => {
  if (userDataUnsubscribe) {
    userDataUnsubscribe();
  }
});
</script>

<style scoped>
/* 기존 스타일은 변경사항이 없으므로 생략 */
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
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
  position: relative;
}
.play-count {
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: #f8f9fa;
  color: #333;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 0.9em;
  font-weight: 500;
}
.crystal-container {
  cursor: pointer;
  margin: 20px auto;
  width: 200px;
  height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  user-select: none;
}
.crystal-container.harvestable {
  animation: glowing 1.5s infinite;
}
@keyframes glowing {
  0% { filter: drop-shadow(0 0 5px #3498db); }
  50% { filter: drop-shadow(0 0 20px #3498db); }
  100% { filter: drop-shadow(0 0 5px #3498db); }
}
.crystal-image {
  width: 100%;
  transition: transform 0.1s ease;
}
.floating-number {
  position: absolute;
  font-size: 1.5em;
  font-weight: bold;
  color: #007bff;
  animation: floatUp 1s ease-out forwards;
  pointer-events: none;
}
@keyframes floatUp {
  to {
    transform: translateY(-50px);
    opacity: 0;
  }
}
.score-progress {
  margin: 20px 0;
}
.score-text {
  display: block;
  margin-bottom: 10px;
  font-weight: 500;
}
.progress-bar {
  width: 100%;
  height: 20px;
  background-color: #e9ecef;
  border-radius: 10px;
  overflow: hidden;
}
.progress-bar-inner {
  height: 100%;
  background-color: #007bff;
  border-radius: 10px;
  transition: width 0.2s ease;
}
.harvest-button {
  width: 100%;
  padding: 15px;
  font-size: 1.2em;
  font-weight: bold;
  color: white;
  background-color: #28a745;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  min-height: 58px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}
.harvest-button:disabled {
  background-color: #ccc;
}
.spinner-small {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  display: inline-block;
  vertical-align: middle;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.success-message, .error-message {
  margin-top: 15px;
  font-weight: bold;
}
.success-message { color: #28a745; }
.error-message { color: #dc3545; }
</style>