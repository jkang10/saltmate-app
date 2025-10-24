<template>
  <div class="helia-minigame-container">
    <header class="page-header">
      <h1><i class="fas fa-box-open brand-icon"></i> 헬리아 소금 패키징 챌린지</h1>
      <p>빛나는 헬리아 소금 상자를 정확하고 빠르게 클릭하세요!</p>
    </header>

    <div v-if="playLimitExceeded" class="play-limit-notice card">
      <p><i class="fas fa-exclamation-circle"></i> 오늘은 이미 최대 횟수({{ dailyPlayLimit }}회) 도전했습니다. 내일 다시 참여해주세요!</p>
      <router-link to="/dashboard" class="btn btn-secondary">돌아가기</router-link>
    </div>

    <div v-else class="game-wrapper card">
      <div class="game-ui">
        <div class="ui-item">
          <i class="fas fa-clock"></i> 시간: <strong>{{ timer }}</strong>초
        </div>
        <div class="ui-item">
          <i class="fas fa-star"></i> 점수: <strong>{{ score }}</strong>
        </div>
        <div class="ui-item">
          <i class="fas fa-redo"></i> 남은 횟수: <strong>{{ dailyPlayLimit - currentPlayCount }}</strong> / {{ dailyPlayLimit }}
        </div>
      </div>

      <div class="game-area" @click="handleAreaClick">
        <div v-if="gameState === 'ready'" class="game-overlay">
          <button @click="startGame" :disabled="isLoading" class="btn btn-start">
            <i class="fas fa-play"></i> {{ isLoading ? '준비 중...' : '챌린지 시작' }}
          </button>
        </div>
        <div v-if="gameState === 'ended'" class="game-overlay end-overlay">
          <h2>챌린지 종료!</h2>
          <p class="final-score">최종 점수: <strong>{{ score }}</strong></p>
          <div class="reward-info">
            <p v-if="result.awardedPoints > 0"><i class="fas fa-coins"></i> 획득 보상: {{ result.awardedPoints }} SaltMate</p>
            <p v-if="result.awardedCoupon"><i class="fas fa-tags"></i> 추가 보상: 헬리아 {{ result.awardedCoupon.discountPercent }}% 할인 쿠폰!</p>
          </div>
          <div class="button-group">
            <button @click="resetGame" class="btn btn-retry"><i class="fas fa-redo"></i> 다시 도전</button>
            <router-link to="/dashboard" class="btn btn-secondary"><i class="fas fa-arrow-left"></i> 돌아가기</router-link>
          </div>
        </div>

        <template v-if="gameState === 'playing'">
          <img src="@/assets/hellia_img.png" alt="헬리아 상자"
               class="target-box"
               ref="targetBox"
               :style="targetPosition"
               @click.stop="handleTargetClick"
               @transitionend="onTargetMoveEnd" />

          <span v-for="popup in scorePopups" :key="popup.id"
                class="score-popup"
                :style="{ top: popup.y + 'px', left: popup.x + 'px' }"
                @animationend="removeScorePopup(popup.id)">
            +1
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, functions } from '@/firebaseConfig';

// --- 상태 변수 ---
const gameState = ref('ready'); // ready, playing, ended
const timer = ref(15); // 시간 증가 (10 -> 15)
const score = ref(0);
const targetBox = ref(null);
const result = ref({ awardedPoints: 0, awardedCoupon: null });
let timerId = null;
const isLoading = ref(false);
const dailyPlayLimit = 3;
const currentPlayCount = ref(0);
const playLimitExceeded = computed(() => currentPlayCount.value >= dailyPlayLimit);
const targetPosition = ref({ top: '50%', left: '50%', transform: 'translate(-50%, -50%) scale(1)', opacity: 1 });
const isTargetMoving = ref(false); // 타겟 이동 중 클릭 방지
const scorePopups = ref([]); // 점수 팝업 배열
let popupIdCounter = 0;

// --- Firebase ---
const completeHeliaMinigame = httpsCallable(functions, 'completeHeliaMinigame');

// --- 함수 ---
const checkPlayCount = async () => {
  // 1. 사용자 로그인 상태 확인
  if (!auth.currentUser) {
    console.log("사용자가 로그인되어 있지 않아 플레이 횟수를 확인할 수 없습니다.");
    currentPlayCount.value = dailyPlayLimit; // 로그인 안 됐으면 플레이 불가 처리
    return;
  }

  // 2. 로딩 상태 시작
  isLoading.value = true;

  // 3. 한국 시간 기준 오늘 날짜 문자열 생성 ('YYYY-MM-DD')
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // 한국 시간대 오프셋 (UTC+9)
  const kstNow = new Date(now.getTime() + kstOffset);
  const todayStr = kstNow.toISOString().slice(0, 10);

  // 4. Firestore에서 해당 날짜의 플레이 횟수 문서 참조 생성
  // 경로: /users/{userId}/daily_play_counts/{YYYY-MM-DD}
  const playCountRef = doc(db, 'users', auth.currentUser.uid, 'daily_play_counts', todayStr);

  try {
    // 5. 문서 데이터 가져오기 시도
    const docSnap = await getDoc(playCountRef);

    // 6. 문서가 존재하면 'heliaMinigame' 필드 값 사용, 없으면 0으로 초기화
    if (docSnap.exists()) {
      currentPlayCount.value = docSnap.data().heliaMinigame || 0;
    } else {
      // 오늘 처음 플레이하는 경우 문서가 없으므로 0회
      currentPlayCount.value = 0;
    }
    console.log(`오늘 플레이 횟수 (${todayStr}): ${currentPlayCount.value}`); // 확인용 로그

  } catch (error) {
    // 7. 오류 발생 시 콘솔에 로그 출력 및 플레이 횟수 0으로 처리 (오류 시 플레이 가능하도록)
    console.error("플레이 횟수 확인 중 오류 발생:", error);
    currentPlayCount.value = 0; // 오류 발생 시 안전하게 0으로 설정 (또는 오류 상태 관리)
    // 사용자에게 오류 알림 필요 시 추가 (예: alert 사용)
    // alert("플레이 횟수를 확인하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");

  } finally {
    // 8. 로딩 상태 종료
    isLoading.value = false;
  }
};

const moveTarget = () => {
    if (!targetBox.value?.parentElement) return;
    isTargetMoving.value = true; // 이동 시작
    const gameArea = targetBox.value.parentElement;
    // 패딩 고려하여 이동 범위 제한
    const padding = 20;
    const boxSize = targetBox.value.offsetWidth || 60; // 실제 크기 가져오기
    const maxX = gameArea.clientWidth - boxSize - padding * 2;
    const maxY = gameArea.clientHeight - boxSize - padding * 2;

    const randomX = Math.random() * maxX + padding;
    const randomY = Math.random() * maxY + padding;

    targetPosition.value = {
        top: `${randomY}px`,
        left: `${randomX}px`,
        transform: 'translate(0, 0) scale(1)', // 스케일 초기화
        opacity: 1, // 나타나기
        position: 'absolute',
        transition: 'top 0.3s ease-out, left 0.3s ease-out, transform 0.1s ease-out, opacity 0.2s ease-in-out' // 부드러운 이동
    };
};

// 타겟 이동 애니메이션 종료 시 호출
const onTargetMoveEnd = () => {
    isTargetMoving.value = false; // 이동 완료
};

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

// 타겟 클릭
const handleTargetClick = (event) => {
  if (gameState.value !== 'playing' || isTargetMoving.value) return;

  // 사운드 재생 (구현 필요)
  // playClickSound();

  score.value++;

  // 점수 팝업 생성
  // const rect = event.target.getBoundingClientRect(); // <--- 이 라인 삭제
  const gameAreaRect = event.target.parentElement.getBoundingClientRect();
  // 클릭 위치 근처에 팝업 표시
  const popupX = event.clientX - gameAreaRect.left;
  const popupY = event.clientY - gameAreaRect.top - 20; // 약간 위쪽
  addScorePopup(popupX, popupY);

  // 클릭 효과 (축소 후 원래대로)
  targetPosition.value = { ...targetPosition.value, transform: 'translate(0,0) scale(0.85)', opacity: 0.8 };

  // 약간의 딜레이 후 다음 위치로 이동
  setTimeout(() => {
    if (gameState.value === 'playing') {
      // 사라지는 효과 (선택적)
      targetPosition.value = { ...targetPosition.value, opacity: 0 };
      // 잠시 후 새 위치에서 나타나도록
      setTimeout(moveTarget, 150);
    }
  }, 80); // 클릭 효과 지속 시간
};

// 점수 팝업 추가 함수
const addScorePopup = (x, y) => {
    const newPopup = { id: popupIdCounter++, x, y };
    scorePopups.value.push(newPopup);
};

// 점수 팝업 제거 함수 (애니메이션 종료 시)
const removeScorePopup = (id) => {
    scorePopups.value = scorePopups.value.filter(p => p.id !== id);
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
/* --- 전역 & 레이아웃 --- */
.helia-minigame-container {
  padding: 20px;
  max-width: 700px; /* 최대 너비 조정 */
  margin: 80px auto 40px;
  font-family: 'Noto Sans KR', sans-serif;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.2em;
  color: #1A237E;
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}
.brand-icon {
  color: #FF8F00; /* Heli:A 브랜드 색상 (예시) */
}
.page-header p {
  font-size: 1.05em;
  color: #546E7A;
}

.card {
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.08);
  border: 1px solid #E0E0E0;
  margin-bottom: 25px;
}

.play-limit-notice {
  background-color: #FFF3E0; /* 연한 주황색 배경 */
  color: #E65100; /* 진한 주황색 텍스트 */
  padding: 25px;
  border: 1px solid #FFE0B2;
  text-align: center;
  font-weight: 500;
}
.play-limit-notice i { margin-right: 8px; }

.game-wrapper {
    padding: 25px;
}

/* --- 게임 UI (상단 정보) --- */
.game-ui {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background: #f8f9fa; /* 연한 배경 */
  padding: 12px 20px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  font-size: 1em;
}
.ui-item {
  color: #495057;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ui-item i {
  color: #adb5bd; /* 아이콘 색상 */
}
.ui-item strong {
  color: #212529; /* 강조 텍스트 */
  font-weight: 600;
  font-size: 1.1em;
}

/* --- 게임 영역 --- */
.game-area {
  min-height: 400px; /* 높이 조정 */
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); /* 하늘색 그라데이션 */
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  cursor: default; /* 영역 클릭 기본 커서 */
  border-color: #B3E5FC; /* 테두리 색상 */
}

/* 타겟 박스 (헬리아 이미지) */
.target-box {
  width: 65px; /* 모바일 크기 조정 */
  height: auto;
  cursor: pointer;
  user-select: none;
  position: absolute;
  /* transition 정의는 script에서 동적으로 제어 */
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2)); /* 그림자 효과 */
}
.target-box:active { /* 클릭 시 효과 */
    transform: scale(0.8) !important; /* !important로 transition 재정의 */
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}


/* 게임 오버레이 (시작/종료 화면) */
.game-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85); /* 반투명 흰색 */
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
  text-align: center;
  padding: 20px;
}
.end-overlay h2 {
    font-size: 2em;
    color: #1A237E;
    margin-bottom: 15px;
}
.final-score {
    font-size: 1.4em;
    color: #37474F;
    margin-bottom: 20px;
}
.final-score strong {
    font-size: 1.5em;
    color: #FF8F00; /* 점수 강조 */
}
.reward-info {
    margin-bottom: 25px;
    font-size: 1.1em;
    color: #2E7D32; /* 보상 텍스트 녹색 */
}
.reward-info p { margin: 8px 0; }
.reward-info i { margin-right: 8px; }

.button-group {
    display: flex;
    gap: 15px;
    margin-top: 10px;
}

/* 버튼 공통 스타일 */
.btn {
  padding: 12px 25px;
  border-radius: 8px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 1em;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn:disabled { background-color: #bdc3c7; cursor: not-allowed; }
.btn-start { background-color: #2ecc71; color: white; box-shadow: 0 4px 10px rgba(46, 204, 113, 0.3); }
.btn-start:hover:not(:disabled) { background-color: #27ae60; transform: translateY(-2px); }
.btn-retry { background-color: #3498db; color: white; }
.btn-retry:hover:not(:disabled) { background-color: #2980b9; }
.btn-secondary { background-color: #ecf0f1; color: #34495e; border: 1px solid #bdc3c7; }
.btn-secondary:hover:not(:disabled) { background-color: #dfe6e9; }

/* 점수 팝업 효과 */
.score-popup {
  position: absolute;
  font-size: 1.3em;
  font-weight: bold;
  color: #FF8F00; /* 점수 색상 */
  user-select: none;
  pointer-events: none;
  animation: floatUp 0.8s ease-out forwards;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

@keyframes floatUp {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-40px) scale(0.8);
  }
}


/* --- PC 화면 스타일 --- */
@media (min-width: 768px) {
  .page-header h1 { font-size: 2.5em; }
  .game-area { min-height: 500px; }
  .target-box { width: 80px; }
  .game-ui { font-size: 1.1em; padding: 15px 25px; }
  .btn { padding: 14px 30px; font-size: 1.1em; }
  .end-overlay h2 { font-size: 2.5em; }
  .final-score { font-size: 1.6em; }
}

@keyframes spin { /* 스피너 */
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>