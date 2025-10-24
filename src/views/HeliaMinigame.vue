<template>
  <div class="helia-minigame-container mobile-padding">
    <h1>헬리아 소금 포장하기!</h1>
    <p>제한 시간 안에 헬리아 소금 상자를 최대한 많이 클릭하세요!</p>

    <div v-if="playLimitExceeded" class="play-limit-notice card">
      <p><i class="fas fa-exclamation-circle"></i> 오늘은 이미 최대 횟수({{ dailyPlayLimit }}회) 플레이했습니다. 내일 다시 도전해주세요!</p>
      <router-link to="/dashboard">돌아가기</router-link>
    </div>

    <div v-else>
      <div class="game-ui">
        <div>남은 시간: {{ timer }}초</div>
        <div>점수: {{ score }}</div>
        <div>오늘 남은 횟수: {{ dailyPlayLimit - currentPlayCount }} / {{ dailyPlayLimit }}</div>
      </div>

      <div class="game-area card" @click="handleClick">
        <template v-if="gameState === 'ready'">
          <button @click="startGame" :disabled="isLoading">
            {{ isLoading ? '시작 준비 중...' : '시작하기' }}
          </button>
        </template>
        <template v-else-if="gameState === 'playing'">
          <img src="@/assets/hellia_img.png" alt="클릭하세요" class="target-box" ref="targetBox" :style="targetPosition">
        </template>
        <template v-else-if="gameState === 'ended'">
          <h2>게임 종료!</h2>
          <p>최종 점수: {{ score }}</p>
          <p v-if="result.awardedPoints > 0">획득 보상: {{ result.awardedPoints }} SaltMate</p>
          <p v-if="result.awardedCoupon">추가 보상: 헬리아 {{ result.awardedCoupon.discountPercent }}% 할인 쿠폰!</p>
          <button @click="resetGame">다시하기 준비</button> <router-link to="/dashboard">돌아가기</router-link>
        </template>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, Timestamp } from 'firebase/firestore'; // Timestamp 추가
import { auth, db, functions } from '@/firebaseConfig';

const gameState = ref('ready'); // ready, playing, ended
const timer = ref(10);
const score = ref(0);
const targetBox = ref(null);
const result = ref({ awardedPoints: 0, awardedCoupon: null });
let timerId = null;
const isLoading = ref(false); // 로딩 상태 추가

// --- 👇 일일 플레이 제한 관련 상태 추가 👇 ---
const dailyPlayLimit = 3; // 최대 플레이 횟수
const currentPlayCount = ref(0);
const playLimitExceeded = computed(() => currentPlayCount.value >= dailyPlayLimit);
// --- 상태 추가 끝 ---

// --- 👇 클릭 대상 랜덤 위치 관련 상태 추가 👇 ---
const targetPosition = ref({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
// --- 상태 추가 끝 ---

const completeHeliaMinigame = httpsCallable(functions, 'completeHeliaMinigame');

// --- 👇 플레이 횟수 확인 함수 추가 👇 ---
const checkPlayCount = async () => {
  if (!auth.currentUser) return;
  isLoading.value = true; // 로딩 시작
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + kstOffset);
  const todayStr = kstNow.toISOString().slice(0, 10);
  const playCountRef = doc(db, 'users', auth.currentUser.uid, 'daily_play_counts', todayStr);

  try {
    const docSnap = await getDoc(playCountRef);
    if (docSnap.exists()) {
      currentPlayCount.value = docSnap.data().heliaMinigame || 0;
    } else {
      currentPlayCount.value = 0;
    }
  } catch (error) {
    console.error("플레이 횟수 확인 오류:", error);
    currentPlayCount.value = 0; // 오류 시 0으로 초기화
  } finally {
      isLoading.value = false; // 로딩 종료
  }
};
// --- 함수 추가 끝 ---

// --- 👇 클릭 대상 위치 랜덤 변경 함수 추가 👇 ---
const moveTarget = () => {
    if (!targetBox.value?.parentElement) return;
    const gameArea = targetBox.value.parentElement;
    const maxX = gameArea.clientWidth - targetBox.value.width;
    const maxY = gameArea.clientHeight - targetBox.value.height;

    const randomX = Math.random() * maxX;
    const randomY = Math.random() * maxY;

    targetPosition.value = {
        top: `${randomY}px`,
        left: `${randomX}px`,
        transform: 'translate(0, 0)', // translate 초기화
        position: 'absolute' // position을 absolute로 명시
    };
};
// --- 함수 추가 끝 ---

const startGame = async () => {
  // 시작 전 플레이 횟수 다시 확인
  await checkPlayCount();
  if (playLimitExceeded.value) {
      alert(`오늘은 이미 ${dailyPlayLimit}번 플레이했습니다.`);
      return;
  }

  score.value = 0;
  timer.value = 10;
  result.value = { awardedPoints: 0, awardedCoupon: null };
  gameState.value = 'playing';

  // 첫 위치 설정 (setTimeout으로 DOM 업데이트 기다림)
  setTimeout(moveTarget, 0);

  // 타이머 시작
  timerId = setInterval(() => {
    timer.value--;
    if (timer.value <= 0) {
      endGame();
    }
  }, 1000);
};

const endGame = async () => {
  clearInterval(timerId);
  timerId = null;
  gameState.value = 'ended';
  isLoading.value = true; // 결과 처리 중 로딩 표시

  try {
    const response = await completeHeliaMinigame({ score: score.value });
    result.value = response.data;
    // 게임 종료 후 플레이 횟수 업데이트 반영
    currentPlayCount.value++;
  } catch (error) {
    console.error("결과 전송 오류:", error);
    alert(`결과 처리 중 오류: ${error.message}`);
    // 서버에서 횟수 제한 걸렸을 경우 프론트에도 반영
    if (error.code === 'resource-exhausted') {
        currentPlayCount.value = dailyPlayLimit;
    }
  } finally {
      isLoading.value = false;
  }
};

const handleClick = (event) => {
  if (gameState.value !== 'playing') return;

  // 클릭 대상(이미지)을 직접 클릭했는지 확인
  if (targetBox.value && targetBox.value.contains(event.target)) {
    score.value++;
    // 클릭 시 시각 효과 및 위치 이동
    targetBox.value.style.transform = 'scale(0.9)';
    setTimeout(() => {
        if(targetBox.value) targetBox.value.style.transform = 'scale(1)';
        moveTarget(); // 클릭 성공 시 위치 변경
    }, 60); // 약간의 딜레이 후 이동
  }
};

// --- 👇 게임 초기화 함수 추가 👇 ---
const resetGame = () => {
    gameState.value = 'ready';
    score.value = 0;
    timer.value = 10;
    result.value = { awardedPoints: 0, awardedCoupon: null };
    // 플레이 횟수는 endGame에서 업데이트되므로 여기서는 리셋하지 않음
    // 필요 시 checkPlayCount() 다시 호출하여 최신화
    checkPlayCount();
};
// --- 함수 추가 끝 ---

onMounted(() => {
  checkPlayCount(); // 컴포넌트 마운트 시 플레이 횟수 확인
});

onUnmounted(() => {
  if (timerId) clearInterval(timerId);
});
</script>

<style scoped>
/* 모바일 우선 스타일 */
.helia-minigame-container { padding: 15px; text-align: center; }
.play-limit-notice { background-color: #f8d7da; color: #721c24; padding: 20px; border: 1px solid #f5c6cb; }
.play-limit-notice i { margin-right: 8px; }
.game-ui { display: flex; justify-content: space-around; align-items: center; margin-bottom: 15px; font-size: 1.1em; background: #f9f9f9; padding: 10px; border-radius: 6px;}
.game-area {
  min-height: 350px; /* 높이 증가 */
  background-color: #eaf2f8; /* 배경색 변경 */
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: default; /* 전체 영역 클릭 대신 타겟 클릭 */
  position: relative;
  overflow: hidden; /* 타겟이 밖으로 나가지 않도록 */
}
.target-box {
  width: 60px; /* 크기 조정 */
  height: auto;
  cursor: pointer;
  transition: transform 0.06s ease-out, top 0.1s linear, left 0.1s linear; /* 이동 애니메이션 추가 */
  user-select: none;
  position: absolute; /* 랜덤 위치 배치를 위해 */
  /* 초기 위치 제거 (moveTarget에서 설정) */
}
button, .router-link { margin: 10px; padding: 10px 15px; border-radius: 5px; text-decoration: none; border: none; cursor: pointer;}
button { background-color: #2ecc71; color: white; }
button:disabled { background-color: #bdc3c7; }
.router-link { background-color: #95a5a6; color: white; display: inline-block; }

/* PC 화면 스타일 */
@media (min-width: 768px) {
  .game-area { min-height: 450px; }
  .target-box { width: 80px; }
}
</style>