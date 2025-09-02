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

      <div class="crystal-container" @click="handleClick">
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
        :disabled="isHarvesting || score < scoreGoal"
      >
        <span v-if="isHarvesting" class="spinner-small"></span>
        <span v-else
          >수확하기 ({{
            Math.floor(score / 10).toLocaleString()
          }}P
          획득)</span
        >
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import { db, auth } from "@/firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const score = ref(0);
const scoreGoal = ref(1000);
const isHarvesting = ref(false);
const floatingNumbers = ref([]);
const userData = reactive({
  saltGameData: {
    date: "",
    count: 0,
  },
});
let userDataUnsubscribe = null;

// [수정] 요일별 플레이 횟수 배열 정의
const playLimits = [1, 1, 2, 1, 2, 1, 2]; // 일, 월, 화, 수, 목, 금, 토

const maxPlaysToday = computed(() => {
  const dayOfWeek = new Date().getDay();
  // [수정] 오늘 요일에 맞는 횟수를 가져옵니다.
  return playLimits[dayOfWeek];
});

const remainingPlays = computed(() => {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (userData.saltGameData.date === todayStr) {
    return maxPlaysToday.value - userData.saltGameData.count;
  }
  return maxPlaysToday.value; // 날짜가 다르면 초기 횟수 반환
});

const progressBarWidth = computed(() => {
  const percentage = (score.value / scoreGoal.value) * 100;
  return `${Math.min(percentage, 100)}%`;
});

const handleClick = (event) => {
  if (score.value >= scoreGoal.value) return;
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
  if (score.value < scoreGoal.value) {
    alert("점수가 부족하여 수확할 수 없습니다.");
    return;
  }
  isHarvesting.value = true;
  try {
    const functions = getFunctions();
    const harvestCrystals = httpsCallable(functions, "harvestSaltCrystals");
    const result = await harvestCrystals({ clicks: score.value });
    alert(
      `${result.data.awardedPoints.toLocaleString()} SaltMate 포인트를 획득했습니다!`,
    );
    score.value = 0; // 점수 초기화
  } catch (error) {
    console.error("수확 중 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isHarvesting.value = false;
  }
};

onMounted(() => {
  if (auth.currentUser) {
    const userRef = doc(db, "users", auth.currentUser.uid);
    userDataUnsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().saltGameData) {
        userData.saltGameData = docSnap.data().saltGameData;
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
/* (기존 스타일은 변경사항이 없으므로 생략) */
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
  pointer-events: none; /* 클릭 이벤트 방해 방지 */
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
  display: inline-block; /* 추가: 버튼 내에서 올바르게 표시되도록 */
  vertical-align: middle; /* 추가: 텍스트와 세로 정렬 */
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>