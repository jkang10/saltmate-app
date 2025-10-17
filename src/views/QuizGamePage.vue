<template>
  <div class="quiz-page-container">
    <div v-if="!game" class="state-screen">
      <div class="spinner"></div>
      <p>게임 정보를 불러오는 중...</p>
    </div>

    <div v-else-if="game.status === 'waiting'" class="state-screen">
      <h2>솔트 스칼라 퀴즈</h2>
      <p>매시간 정각에 시작되는 서바이벌 퀴즈쇼!</p>
      <div class="countdown">
        {{ timeToStart > 0 ? `게임 시작까지 약 ${timeToStart}초` : '곧 시작합니다!' }}
      </div>
      <button @click="joinGame" :disabled="isJoined || isLoading">
        {{ isJoined ? '참가 완료!' : '참가하기 (100 포인트 즉시 지급)' }}
      </button>
    </div>

    <div v-else-if="game.status === 'playing' && currentQuestion" class="playing-screen">
      <div class="quiz-header">
        <h3>{{ game.currentQuestionIndex + 1 }} / {{ game.questions.length }}</h3>
        <div class="timer-bar" :style="{ width: `${(timer/10) * 100}%` }"></div>
      </div>
      <div class="question-area">
        <h2>{{ currentQuestion.question }}</h2>
      </div>
      <div v-if="currentQuestion.category === 'golden_bell'" class="answer-area">
          <input type="text" v-model="goldenBellAnswer" placeholder="정답을 입력하세요" @keyup.enter="submitGoldenBell" :disabled="hasAnswered">
          <button @click="submitGoldenBell" :disabled="hasAnswered">제출</button>
      </div>
      <div v-else class="answer-area">
        <button
          v-for="(choice, index) in currentQuestion.choices"
          :key="index"
          @click="selectAnswer(index)"
          :class="getChoiceClass(index)"
          :disabled="hasAnswered"
        >
          {{ choice }}
        </button>
      </div>
      <div class="status-footer">
        <p v-if="myStatus === 'eliminated'">탈락했습니다. 결과를 지켜봐 주세요.</p>
        <p v-else-if="hasAnswered">답변을 제출했습니다.</p>
      </div>
    </div>

    <div v-else-if="game.status === 'finished'" class="state-screen">
      <h2>게임 종료!</h2>
      <div v-if="game.winner">
        <p class="winner-text">최후의 1인: {{ winnerName }}</p>
        <p>우승 상금 10,000 SaltMate 포인트를 획득했습니다!</p>
      </div>
      <div v-else>
        <p>최종 우승자가 없습니다.</p>
      </div>
      <p>다음 게임은 잠시 후 정각에 시작됩니다.</p>
      <router-link to="/dashboard">대시보드로 돌아가기</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { getDatabase, ref as dbRef, onValue, off } from "firebase/database";
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '@/firebaseConfig';

const game = ref(null);
const serverTimeOffset = ref(0);
const timer = ref(10);
const goldenBellAnswer = ref('');
let timerInterval = null;

const rtdb = getDatabase();
const gameRef = dbRef(rtdb, 'quizGame/currentGame');

const timeToStart = computed(() => {
    if (!game.value || game.value.status !== 'waiting') return 0;
    const localNow = Date.now() + serverTimeOffset.value;
    return Math.max(0, Math.round((game.value.startTime - localNow) / 1000));
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
    if(!game.value || !game.value.winner) return '';
    return game.value.participants?.[game.value.winner]?.name || '알 수 없음';
});

const joinGame = async () => {
  try {
    const joinFunc = httpsCallable(functions, 'joinQuizGame');
    await joinFunc();
  } catch (error) {
    alert(`참가 실패: ${error.message}`);
  }
};

const selectAnswer = async (index) => {
    if(hasAnswered.value || myStatus.value === 'eliminated') return;
    try {
        const submitFunc = httpsCallable(functions, 'submitQuizAnswer');
        await submitFunc({ questionIndex: game.value.currentQuestionIndex, answerIndex: index });
    } catch (error) {
        console.error("정답 제출 오류:", error);
    }
};

const submitGoldenBell = async () => {
    if(hasAnswered.value || myStatus.value === 'eliminated' || !goldenBellAnswer.value) return;
     try {
        const submitFunc = httpsCallable(functions, 'submitQuizAnswer');
        await submitFunc({ questionIndex: game.value.currentQuestionIndex, answerText: goldenBellAnswer.value });
        goldenBellAnswer.value = '';
    } catch (error) {
        console.error("골든벨 정답 제출 오류:", error);
    }
};

const getChoiceClass = (index) => {
    if (!hasAnswered.value) return '';
    const myAnswer = game.value.participants?.[auth.currentUser.uid]?.answers?.[game.value.currentQuestionIndex]?.answerIndex;
    const correctAnswer = currentQuestion.value.answer;
    if (index === correctAnswer) return 'correct';
    if (index === myAnswer) return 'incorrect';
    return '';
};

const updateTimer = () => {
    if(timerInterval) clearInterval(timerInterval);
    if(game.value?.status === 'playing') {
        timerInterval = setInterval(() => {
            const localNow = Date.now() + serverTimeOffset.value;
            const newTimer = Math.max(0, Math.round((game.value.roundEndTime - 5000 - localNow) / 1000));
            timer.value = newTimer;
        }, 1000);
    }
};

onMounted(() => {
  onValue(gameRef, (snapshot) => {
    game.value = snapshot.val();
    updateTimer();
  });
});

onUnmounted(() => {
  off(gameRef);
  if(timerInterval) clearInterval(timerInterval);
});

</script>

<style scoped>
.quiz-page-container {
  padding: 20px;
  max-width: 800px;
  margin: 90px auto 20px;
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  text-align: center;
}
.state-screen {
  padding: 40px;
}
.countdown {
  font-size: 1.5em;
  font-weight: bold;
  color: #e74c3c;
  margin: 20px 0;
}
.playing-screen {
  padding: 20px;
}
.quiz-header {
  margin-bottom: 20px;
}
.timer-bar {
  height: 10px;
  background-color: #2ecc71;
  border-radius: 5px;
  transition: width 1s linear;
}
.question-area {
  margin: 40px 0;
  min-height: 100px;
}
.answer-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}
.answer-area button {
  padding: 20px;
  font-size: 1.2em;
  cursor: pointer;
  border-radius: 8px;
  border: 2px solid #bdc3c7;
  background-color: #ecf0f1;
  transition: all 0.2s;
}
.answer-area button:hover:not(:disabled) {
  background-color: #d2d7d9;
}
.answer-area button:disabled {
  cursor: not-allowed;
}
.answer-area button.correct {
  background-color: #2ecc71;
  color: white;
  border-color: #27ae60;
}
.answer-area button.incorrect {
  background-color: #e74c3c;
  color: white;
  border-color: #c0392b;
}
.status-footer {
  margin-top: 20px;
  font-size: 1.1em;
  color: #7f8c8d;
}
.winner-text {
    font-size: 1.8em;
    font-weight: bold;
    color: #f1c40f;
}
</style>