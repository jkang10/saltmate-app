<template>
  <div class="quiz-page-container">
    <div v-if="!game" class="state-screen">
      <div class="spinner"></div>
      <p>게임 정보를 불러오는 중...</p>
    </div>

    <div v-else-if="shouldShowWaitingScreen" class="state-screen">
      <i class="fas fa-trophy title-icon"></i>
      <h2 class="game-title">솔트 스칼라 퀴즈</h2>
      <p class="game-description">매시간 정각에 시작되는 서바이벌 퀴즈쇼!<br>최후의 1인이 되어 특별한 보상을 획득하세요.</p>
      <div class="countdown">
        {{ displayTimeToStart > 0 ? `게임 시작까지 약 ${displayTimeToStart}초` : '잠시 후 시작됩니다!' }}
      </div>
      <button @click="joinGame" class="action-button join-button" :disabled="isJoined || isLoading">
        <span v-if="isJoined">참가 완료!</span>
        <span v-else>참가하기 (100 포인트 즉시 지급)</span>
      </button>
    </div>

    <div v-else-if="game.status === 'playing' && isGameValid && currentQuestion" class="playing-screen">
      <div class="quiz-header">
        <span class="question-counter">{{ game.currentQuestionIndex + 1 }} / {{ game.questions.length }}</span>
        <div class="timer-container">
          <div class="timer-bar" :style="{ width: `${(timer/10) * 100}%` }"></div>
        </div>
      </div>
      <div class="question-area">
        <p class="question-category">{{ currentQuestion.category }}</p>
        <h2>{{ currentQuestion.question }}</h2>
      </div>
      <div v-if="currentQuestion.category === 'golden_bell'" class="answer-area golden-bell">
          <input type="text" v-model="goldenBellAnswer" class="golden-bell-input" placeholder="정답을 입력하세요" @keyup.enter="submitGoldenBell" :disabled="hasAnswered">
          <button @click="submitGoldenBell" class="action-button" :disabled="hasAnswered">제출</button>
      </div>
      <div v-else class="answer-area">
        <button
          v-for="(choice, index) in currentQuestion.choices"
          :key="index"
          @click="selectAnswer(index)"
          class="choice-button"
          :class="getChoiceClass(index)"
          :disabled="hasAnswered"
        >
          <span class="choice-number">{{ index + 1 }}</span>
          <span class="choice-text">{{ choice }}</span>
        </button>
      </div>
      <div class="status-footer">
        <p v-if="myStatus === 'eliminated'">아쉽지만 탈락했습니다. 다음 라운드를 지켜봐 주세요.</p>
        <p v-else-if="hasAnswered">답변을 제출했습니다.</p>
      </div>
    </div>

    <div v-else-if="game.status === 'finished'" class="state-screen">
      <i class="fas fa-crown title-icon"></i>
      <h2 class="game-title">게임 종료!</h2>
      <div v-if="game.winner">
        <p class="winner-label">최후의 1인</p>
        <p class="winner-text">{{ winnerName }}</p>
        <p class="game-description">우승 상금 1,000 SaltMate 포인트를 획득했습니다!</p>
        </div>
      <div v-else>
        <p class="game-description">최종 우승자가 없습니다. 아쉽지만 다음 기회에!</p>
      </div>
      <p class="next-game-info">다음 게임은 {{ nextGameTime }}에 시작됩니다.</p>
      <router-link to="/dashboard" class="action-button">대시보드로 돌아가기</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { getDatabase, ref as dbRef, onValue, off } from "firebase/database";
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app, auth } from '@/firebaseConfig';

const game = ref(null);
const serverTimeOffset = ref(0);
const timer = ref(10);
const goldenBellAnswer = ref('');
let timerInterval = null;
const isLoading = ref(false);

const displayTimeToStart = ref(0);
let countdownInterval = null;

const functionsInSeoul = getFunctions(app, 'asia-northeast3');

const rtdb = getDatabase();
const gameRef = dbRef(rtdb, 'quizGame/currentGame');

// [신규] 현재 게임 상태가 유효한지(시간이 지나지 않았는지) 확인하는 computed 속성
const isGameValid = computed(() => {
  if (!game.value || game.value.status !== 'playing') return false;
  
  const localNow = Date.now() + serverTimeOffset.value;
  // 라운드 종료 시간에서 5초 이상 지났다면 '죽은 게임'으로 간주 (DB가 업데이트 안 된 상태)
  // 이렇게 하면 퀴즈 시간이 아닐 때 들어와도 문제 화면이 안 뜨고 대기 화면으로 넘어감
  if (localNow > (game.value.roundEndTime + 5000)) {
      return false;
  }
  return true;
});

// [신규] 대기 화면을 보여줄지 결정하는 통합 computed 속성
const shouldShowWaitingScreen = computed(() => {
    if (!game.value) return false;
    
    // 1. DB 상태가 대기 중일 때
    if (game.value.status === 'waiting') return true;
    
    // 2. DB 상태가 게임 중이지만, 시간이 만료되어 유효하지 않을 때 (오류 상황 방지)
    if (game.value.status === 'playing' && !isGameValid.value) return true;

    // 3. 게임 종료 상태지만, 다음 게임 시간이 더 가까워졌을 때 (여기선 간단히 처리)
    // (필요 시 추가 로직 가능)
    
    return false;
});

const currentQuestion = computed(() => {
    if (!game.value || game.value.currentQuestionIndex < 0) return null;
    return game.value.questions[game.value.currentQuestionIndex];
});

const myStatus = computed(() => {
    if (!game.value || !auth.currentUser) return 'spectator';
    return game.value.participants?.[auth.currentUser.uid]?.status || 'spectator';
});

const isJoined = computed(() => {
    if (!game.value || !auth.currentUser) return false;
    return !!game.value.participants?.[auth.currentUser.uid];
});

const hasAnswered = computed(() => {
    if (!game.value || !auth.currentUser || !currentQuestion.value) return false;
    const myAnswers = game.value.participants?.[auth.currentUser.uid]?.answers;
    return !!myAnswers?.[game.value.currentQuestionIndex];
});

const winnerName = computed(() => {
    if(!game.value || !game.value.winner) return '알 수 없음';
    return game.value.winner;
});

const nextGameTime = computed(() => {
  const now = new Date();
  const allowedHours = [0, 9, 12, 15, 18, 21];
  const currentHour = now.getHours();
  let nextHour = allowedHours.find(hour => hour > currentHour);
  if (nextHour === undefined) {
    nextHour = 0;
  }
  return `${nextHour}시 정각`;
});

const joinGame = async () => {
  isLoading.value = true;
  try {
    const joinFunc = httpsCallable(functionsInSeoul, 'joinQuizGame');
    await joinFunc();
  } catch (error) {
    alert(`참가 실패: ${error.message}`);
  } finally {
    isLoading.value = false;
  }
};

const selectAnswer = async (index) => {
    if(hasAnswered.value || myStatus.value === 'eliminated') return;
    try {
        const submitFunc = httpsCallable(functionsInSeoul, 'submitQuizAnswer');
        await submitFunc({ questionIndex: game.value.currentQuestionIndex, answerIndex: index });
    } catch (error) {
        console.error("정답 제출 오류:", error);
        alert(`정답 제출 오류: ${error.message}`);
    }
};

const submitGoldenBell = async () => {
    if(hasAnswered.value || myStatus.value === 'eliminated' || !goldenBellAnswer.value) return;
     try {
        const submitFunc = httpsCallable(functionsInSeoul, 'submitQuizAnswer');
        await submitFunc({ questionIndex: game.value.currentQuestionIndex, answerText: goldenBellAnswer.value });
        goldenBellAnswer.value = '';
    } catch (error) {
        console.error("골든벨 정답 제출 오류:", error);
        alert(`골든벨 정답 제출 오류: ${error.message}`);
    }
};

const getChoiceClass = (index) => {
    if (!hasAnswered.value) return '';
    const myAnswer = game.value.participants?.[auth.currentUser.uid]?.answers?.[game.value.currentQuestionIndex]?.answerIndex;
    const correctAnswer = currentQuestion.value.answer;
    const roundEndTime = game.value.roundEndTime || 0;
    const isRoundOver = (Date.now() + serverTimeOffset.value) > roundEndTime - 4500;

    if (!isRoundOver) {
      if (index === myAnswer) return 'selected';
      return '';
    }
    
    if (index === correctAnswer) return 'correct';
    if (index === myAnswer) return 'incorrect';

    return 'disabled';
};

const updateTimer = () => {
    if(timerInterval) clearInterval(timerInterval);
    if(game.value?.status === 'playing') {
        timerInterval = setInterval(() => {
            const localNow = Date.now() + serverTimeOffset.value;
            const newTimer = Math.max(0, Math.round((game.value.roundEndTime - 5000 - localNow) / 1000));
            timer.value = newTimer;
        }, 200);
    }
};

const updateCountdown = () => {
  if (countdownInterval) clearInterval(countdownInterval);

  // 'waiting' 상태이거나, 'playing' 상태지만 유효하지 않은(시간 지난) 경우 카운트다운 계산
  if (game.value?.status === 'waiting' || (game.value?.status === 'playing' && !isGameValid.value)) {
    const update = () => {
      const localNow = Date.now() + serverTimeOffset.value;
      // 다음 게임 시작 시간 계산 (DB에 있는 startTime이 미래라면 그것 사용, 아니면 다음 정각 계산)
      let targetTime = game.value.startTime;
      
      // DB의 startTime이 이미 지났다면(오류 상황), 다음 정각을 계산해서 보여줌
      if (targetTime < localNow) {
         const now = new Date();
         const allowedHours = [0, 9, 12, 15, 18, 21];
         let nextHour = allowedHours.find(h => h > now.getHours());
         if(nextHour === undefined) nextHour = 24; // 자정(내일 0시)
         
         const nextDate = new Date(now);
         nextDate.setHours(nextHour, 0, 0, 0);
         if(nextHour === 24) nextDate.setDate(nextDate.getDate() + 1);
         
         targetTime = nextDate.getTime();
      }

      displayTimeToStart.value = Math.max(0, Math.round((targetTime - localNow) / 1000));
    };
    update();
    countdownInterval = setInterval(update, 1000);
  }
};

onMounted(() => {
  onValue(gameRef, (snapshot) => {
    game.value = snapshot.val();
    updateTimer();
    updateCountdown();
  });
});

onUnmounted(() => {
  off(gameRef);
  if (timerInterval) clearInterval(timerInterval);
  if (countdownInterval) clearInterval(countdownInterval);
});
</script>

<style scoped>
.quiz-page-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px);
  padding: 20px;
  background: linear-gradient(135deg, #2c3e50, #34495e);
  color: #ecf0f1;
}
.state-screen, .playing-screen {
  width: 100%;
  max-width: 800px;
  padding: 40px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
  text-align: center;
}
.title-icon {
  font-size: 4em;
  color: #f1c40f;
  margin-bottom: 20px;
  text-shadow: 0 0 15px #f1c40f;
}
.game-title {
  font-size: 2.8em;
  font-weight: 700;
  margin-bottom: 10px;
}
.game-description, .next-game-info {
  font-size: 1.1em;
  color: #bdc3c7;
  line-height: 1.6;
}
.countdown {
  font-size: 1.5em;
  font-weight: bold;
  color: #e67e22;
  margin: 25px 0;
  background: rgba(0,0,0,0.2);
  padding: 10px;
  border-radius: 8px;
}
.action-button {
  padding: 15px 30px;
  font-size: 1.2em;
  font-weight: bold;
  cursor: pointer;
  border-radius: 8px;
  border: none;
  background: linear-gradient(145deg, #f1c40f, #e67e22);
  color: white;
  text-decoration: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}
.action-button:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}
.action-button:disabled {
  background: #7f8c8d;
  cursor: not-allowed;
}
.playing-screen {
  padding: 25px 40px;
}
.quiz-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
}
.question-counter {
  font-size: 1.1em;
  font-weight: bold;
}
.timer-container {
  flex-grow: 1;
  height: 12px;
  background-color: rgba(0,0,0,0.3);
  border-radius: 6px;
}
.timer-bar {
  height: 100%;
  background-image: linear-gradient(90deg, #e67e22, #f1c40f);
  border-radius: 6px;
  transition: width 0.2s linear;
}
.question-area {
  margin: 30px 0 40px 0;
  min-height: 100px;
}
.question-category {
  font-size: 0.9em;
  text-transform: uppercase;
  color: #f1c40f;
  letter-spacing: 1px;
  margin-bottom: 10px;
}
.question-area h2 {
  font-size: 1.8em;
  margin: 0;
}
.answer-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.choice-button {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  font-size: 1.2em;
  text-align: left;
  cursor: pointer;
  border-radius: 10px;
  border: 2px solid rgba(255,255,255,0.2);
  background-color: transparent;
  color: #ecf0f1;
  transition: all 0.2s;
}
.choice-button:hover:not(:disabled) {
  background-color: rgba(255,255,255,0.1);
  border-color: #f1c40f;
}
.choice-button.selected {
  background-color: rgba(52, 152, 219, 0.5);
  border-color: #3498db;
}
.choice-button.correct {
  background-color: #27ae60;
  border-color: #2ecc71;
  color: white;
  animation: pulse-green 0.5s;
}
.choice-button.incorrect {
  background-color: #c0392b;
  border-color: #e74c3c;
  color: white;
  animation: shake-horizontal 0.5s;
}
.choice-button:disabled {
  cursor: not-allowed;
}
.choice-button.disabled {
  opacity: 0.5;
}
.choice-number {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: rgba(0,0,0,0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
}
.golden-bell {
  display: flex;
  gap: 15px;
}
.golden-bell-input {
  flex-grow: 1;
  padding: 15px;
  font-size: 1.2em;
  border-radius: 8px;
  border: 2px solid rgba(255,255,255,0.2);
  background-color: transparent;
  color: white;
}
.golden-bell-input:focus {
  outline: none;
  border-color: #f1c40f;
}
.status-footer {
  margin-top: 25px;
  font-size: 1.1em;
  color: #bdc3c7;
  min-height: 25px;
}
.winner-label {
  font-size: 1.2em;
  color: #bdc3c7;
}
.spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 4px solid #fff;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px auto;
}
.winner-text {
  font-size: 2.5em;
  font-weight: bold;
  color: #f1c40f;
  margin: 5px 0 15px 0;
  animation: pulse-gold 1.5s infinite;
}

@media (max-width: 768px) {
  .state-screen, .playing-screen {
    padding: 25px;
  }
  .answer-area {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  .action-button {
    width: 100%;
    padding: 15px;
    font-size: 1.1em;
  }
  .game-title {
    font-size: 2.2em;
  }
  .question-area h2 {
    font-size: 1.5em;
  }
  .choice-button {
    padding: 15px;
    font-size: 1.1em;
  }
  .golden-bell {
    flex-direction: column;
  }
  .golden-bell .action-button {
    font-size: 1em;
  }
}

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes pulse-green { 0% { box-shadow: 0 0 0 0 #2ecc71; } 100% { box-shadow: 0 0 15px 5px transparent; } }
@keyframes pulse-gold { 0% { text-shadow: 0 0 5px #f1c40f; } 50% { text-shadow: 0 0 20px #f39c12; } 100% { text-shadow: 0 0 5px #f1c40f; } }
@keyframes shake-horizontal { 0%, 100% { transform: translateX(0); } 10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); } 20%, 40%, 60%, 80% { transform: translateX(5px); } }
</style>