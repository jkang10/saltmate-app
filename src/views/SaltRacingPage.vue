<template>
  <div class="racing-page">
    <div class="game-stats-glass">
      <div class="stat-item">
        <span>보유 포인트</span>
        <strong>{{ (userPoints || 0).toLocaleString() }} P</strong>
      </div>
      <div class="stat-item">
        <span>남은 횟수</span>
        <strong>{{ 20 - todayPlayCount }} / 20</strong>
      </div>
    </div>

    <div class="game-container card glassmorphism">
      <header class="game-header">
        <h2><i class="fas fa-flag-checkered"></i> 솔트 레이싱</h2>
        <p class="sub-text">가장 컨디션이 좋아 보이는 선수에게 응원을 보내세요!</p>
      </header>

      <div class="track-scroll-wrapper">
        <div class="track-container">
          <div class="finish-line">
            <div class="finish-flag"><i class="fas fa-flag-checkered"></i></div>
            <div class="finish-line-bar"></div>
          </div>

          <div v-for="(runner, index) in runners" :key="index" class="lane">
            <div class="lane-number">{{ index + 1 }}</div>
            <div class="runner-track">
              <div 
                class="runner" 
                :style="{ left: runner.progress + '%' }"
                :class="{ 'is-winner': gameStatus === 'finished' && resultData?.winnerIndex === index }"
              >
                <div class="runner-body" :class="'color-' + index">
                  <i class="fas fa-horse-head"></i>
                  <span class="runner-label">{{ index + 1 }}번</span>
                </div>
                <div v-if="runner.rank" class="rank-badge">
                  {{ runner.rank }}등
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="gameStatus === 'racing'" class="racing-message-box">
        <h3><i class="fas fa-running"></i> 경기 진행 중...</h3>
        <p>달려라! {{ selectedRunner + 1 }}번마!</p>
      </div>

      <div class="control-panel" v-if="gameStatus === 'idle'">
        
        <div class="panel-section">
          <h4>우승 후보 선택 <small>(배당 4.5배)</small></h4>
          <div class="runner-buttons">
            <button 
              v-for="(n, i) in 5" 
              :key="i"
              @click="selectedRunner = i"
              :class="['runner-btn', 'color-' + i, { active: selectedRunner === i }]"
            >
              <i class="fas fa-horse-head"></i> {{ n }}번
            </button>
          </div>
        </div>

        <div class="panel-section">
          <h4>베팅 금액</h4>
          <div class="amount-buttons">
            <button 
              v-for="amount in allowedBets" 
              :key="amount"
              @click="selectedBet = amount"
              :class="{ active: selectedBet === amount }"
              :disabled="userPoints < amount"
            >
              {{ amount }} P
            </button>
          </div>
        </div>

        <button 
          class="btn-start" 
          @click="startGame" 
          :disabled="selectedRunner === null || !selectedBet || isProcessing"
        >
          <span v-if="isProcessing" class="spinner-small"></span>
          <span v-else>경기 시작하기</span>
        </button>
      </div>
    </div>

    <div v-if="gameStatus === 'finished' && resultData" class="modal-overlay">
      <div class="modal-content">
        <div class="result-header">
          <i v-if="resultData.isWin" class="fas fa-trophy win-icon"></i>
          <i v-else class="fas fa-sad-tear lose-icon"></i>
        </div>
        
        <h2 v-if="resultData.isWin" class="win-title">축하합니다!</h2>
        <h2 v-else class="lose-title">아쉬운 패배...</h2>
        
        <div class="result-details">
          <div class="detail-row">
            <span>우승 선수</span>
            <strong :class="'text-runner-' + resultData.winnerIndex">{{ resultData.winnerIndex + 1 }}번마</strong>
          </div>
          <div class="detail-row" v-if="resultData.isWin">
            <span>획득 상금</span>
            <strong class="win-amount">+{{ resultData.winnings.toLocaleString() }} P</strong>
          </div>
          <p v-else class="lose-desc">
            다음 경기에는 행운이 따를 거예요!
          </p>
        </div>

        <div class="modal-actions">
          <button @click="resetGame" class="btn-retry">한 번 더 도전!</button>
          <button @click="router.push('/dashboard')" class="btn-exit">나가기</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { auth, db, functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';

const router = useRouter();

// --- 상태 변수 ---
const userPoints = ref(0);
const todayPlayCount = ref(0);
const gameStatus = ref('idle'); // idle, racing, finished
const isProcessing = ref(false);

// 5명의 선수 상태 (진행도 0~100)
const runners = reactive(Array.from({ length: 5 }, () => ({ progress: 0, rank: null })));

const selectedRunner = ref(null); // 0~4
const selectedBet = ref(100);
const allowedBets = [100, 300, 500, 800];

const resultData = ref(null);
let animationFrameId = null;

// --- Firebase 연결 ---
const playRacingFunc = httpsCallable(functions, 'playSaltRacing');
let unsubscribeUser = null;
let unsubscribeDaily = null;

onMounted(() => {
  const user = auth.currentUser;
  if (!user) {
    alert("로그인이 필요합니다.");
    router.push('/login');
    return;
  }

  // 유저 포인트 실시간 감지
  unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
    if (docSnap.exists()) {
      userPoints.value = docSnap.data().saltmatePoints || 0;
    }
  });

  // 일일 플레이 횟수 감지
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const todayStr = new Date(now.getTime() + kstOffset).toISOString().slice(0, 10);
  
  unsubscribeDaily = onSnapshot(doc(db, 'users', user.uid, 'daily_play_counts', todayStr), (docSnap) => {
    if (docSnap.exists()) {
      todayPlayCount.value = docSnap.data().saltRacing || 0;
    }
  });
});

onUnmounted(() => {
  if (unsubscribeUser) unsubscribeUser();
  if (unsubscribeDaily) unsubscribeDaily();
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

// --- 게임 로직 ---
const startGame = async () => {
  if (selectedRunner.value === null) return;
  
  if (todayPlayCount.value >= 20) {
    alert("오늘은 더 이상 경기에 참여할 수 없습니다. (일일 20회 제한)");
    return;
  }
  if (userPoints.value < selectedBet.value) {
    alert("포인트가 부족합니다.");
    return;
  }

  isProcessing.value = true;

  try {
    // 1. 서버에 게임 요청 (결과 미리 받기)
    const result = await playRacingFunc({
      betAmount: selectedBet.value,
      selectedRunner: selectedRunner.value
    });
    
    resultData.value = result.data; 
    
    // 2. 애니메이션 시작
    gameStatus.value = 'racing';
    isProcessing.value = false;
    startRaceAnimation(result.data.winnerIndex);

  } catch (error) {
    console.error("게임 시작 오류:", error);
    let msg = error.message;
    if(msg.includes("resource-exhausted")) msg = "일일 참여 횟수를 초과했습니다.";
    alert(msg);
    isProcessing.value = false;
  }
};

const startRaceAnimation = (winnerIndex) => {
  // 초기화
  runners.forEach(r => {
    r.progress = 0;
    r.rank = null;
  });

  let finishedCount = 0;
  // 각 선수의 기본 속도 (랜덤성 부여)
  const speeds = runners.map(() => 0.3 + Math.random() * 0.2); 

  const animate = () => {
    let allFinished = true;

    runners.forEach((runner, index) => {
      // 아직 골인하지 않은 선수만 이동
      if (runner.progress < 100) {
        allFinished = false;
        
        // 랜덤 속도 변동 (역전의 묘미)
        if (Math.random() < 0.05) speeds[index] = 0.2 + Math.random() * 0.5;
        
        // 80% 지점부터 승부 조작 (서버 결과에 맞추기)
        if (runner.progress > 80) {
           if (index === winnerIndex) {
               speeds[index] += 0.05; // 우승자는 가속
           } else if (runners[winnerIndex].progress < 100) {
               speeds[index] *= 0.9; // 우승자가 아직 안 들어왔으면 나머지는 감속
           }
        }

        runner.progress += speeds[index];

        // 결승선 통과 체크
        if (runner.progress >= 100) {
          runner.progress = 100;
          if (!runner.rank) {
            finishedCount++;
            runner.rank = finishedCount;
          }
        }
      }
    });

    if (finishedCount < 5) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      // 경기 종료 후 잠시 대기하다가 결과창 표시
      setTimeout(() => {
        gameStatus.value = 'finished';
      }, 800);
    }
  };

  animationFrameId = requestAnimationFrame(animate);
};

const resetGame = () => {
  gameStatus.value = 'idle';
  selectedRunner.value = null; // 선택 초기화 (선택사항)
  runners.forEach(r => {
    r.progress = 0;
    r.rank = null;
  });
  resultData.value = null;
};
</script>

<style scoped>
/* 전체 페이지 */
.racing-page {
  min-height: 100dvh; /* 모바일 높이 대응 */
  padding: 15px;
  background: radial-gradient(circle at center, #2c3e50 0%, #000000 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: 'Noto Sans KR', sans-serif;
  box-sizing: border-box;
}

/* 상단 스탯 바 */
.game-stats-glass {
  display: flex;
  justify-content: space-around;
  width: 100%;
  max-width: 500px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 10px 15px;
  border-radius: 12px;
  margin-bottom: 15px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}
.stat-item { text-align: center; }
.stat-item span { display: block; font-size: 0.8rem; color: #ccc; margin-bottom: 2px; }
.stat-item strong { font-size: 1.1rem; color: #FFD700; }

/* 게임 컨테이너 */
.game-container {
  width: 100%;
  max-width: 600px;
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 20px 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.game-header { text-align: center; }
.game-header h2 { color: #FFD700; margin: 0 0 5px; font-size: 1.5rem; }
.sub-text { color: #bdc3c7; font-size: 0.9rem; margin: 0; }

/* [핵심] 트랙 스크롤 래퍼 (모바일 대응) */
.track-scroll-wrapper {
  width: 100%;
  overflow-x: auto; /* 가로 스크롤 허용 */
  border-radius: 10px;
  background: #333;
  border: 2px solid #555;
  /* 스크롤바 숨김 (선택사항) */
  scrollbar-width: thin;
  scrollbar-color: #555 #222;
}

/* 실제 트랙 컨테이너 (최소 너비 보장) */
.track-container {
  min-width: 500px; /* 모바일에서도 트랙이 찌그러지지 않도록 최소 너비 설정 */
  padding: 15px 40px 15px 10px; /* 오른쪽 여백은 결승선 공간 */
  position: relative;
  background: repeating-linear-gradient(
    90deg,
    #2c3e50,
    #2c3e50 50px,
    #34495e 50px,
    #34495e 100px
  );
}

.finish-line {
  position: absolute;
  top: 0; bottom: 0; right: 25px;
  width: 8px;
  z-index: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.finish-line-bar {
  width: 100%; height: 100%;
  background: repeating-linear-gradient(0deg, #fff, #fff 10px, #000 10px, #000 20px);
  border: 1px solid #fff;
}
.finish-flag { position: absolute; top: -20px; font-size: 1.2rem; color: #fff; }

/* 레인 (높이 축소) */
.lane {
  display: flex;
  align-items: center;
  height: 40px; /* 높이 줄임 */
  border-bottom: 1px dashed rgba(255,255,255,0.2);
  position: relative;
}
.lane:last-child { border-bottom: none; }

.lane-number {
  width: 20px;
  font-weight: bold;
  color: #aaa;
  font-size: 0.8rem;
  text-align: center;
}

.runner-track {
  flex-grow: 1;
  position: relative;
  height: 100%;
}

/* 달리는 말 (크기 축소) */
.runner {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  transition: left 0.1s linear;
  z-index: 1;
  /* 말 아이콘 위치 보정 (중앙) */
  margin-left: -15px; 
}

.runner-body {
  font-size: 1.8rem; /* 아이콘 크기 */
  position: relative;
  transition: transform 0.2s;
}
.runner.is-winner .runner-body {
  transform: scale(1.2);
  text-shadow: 0 0 15px gold;
  z-index: 10;
}

/* 말 색상 */
.color-0 { color: #ff6b6b; }
.color-1 { color: #48dbfb; }
.color-2 { color: #1dd1a1; }
.color-3 { color: #feca57; }
.color-4 { color: #ff9ff3; }

.runner-label {
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.6rem;
  color: #fff;
  background: rgba(0,0,0,0.6);
  padding: 1px 4px;
  border-radius: 4px;
  white-space: nowrap;
}

.rank-badge {
  position: absolute;
  top: -5px;
  right: -15px;
  background: #fff;
  color: #000;
  font-weight: bold;
  font-size: 0.7rem;
  padding: 1px 5px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  animation: pop 0.3s;
}

/* 경기 중 메시지 */
.racing-message-box {
  text-align: center;
  background: rgba(0,0,0,0.3);
  padding: 15px;
  border-radius: 10px;
  animation: pulse 1.5s infinite;
}
.racing-message-box h3 { margin: 0 0 5px; color: #2ecc71; font-size: 1.2rem; }
.racing-message-box p { margin: 0; color: #fff; }

/* 컨트롤 패널 */
.control-panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 15px;
}
.panel-section { margin-bottom: 20px; }
.panel-section h4 { 
  margin: 0 0 10px 0; 
  color: #ddd; 
  font-size: 1rem; 
  text-align: center;
}
.panel-section h4 small { color: #888; font-weight: normal; }

.runner-buttons, .amount-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.runner-btn, .amount-buttons button {
  flex: 1 1 18%; /* 한 줄에 5개 */
  min-width: 50px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ccc;
  padding: 10px 5px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  transition: all 0.2s;
}

/* 선택된 버튼 스타일 */
.runner-btn.active, .amount-buttons button.active {
  background: #fff;
  color: #333;
  font-weight: bold;
  border-color: #fff;
  transform: scale(1.05);
  box-shadow: 0 0 10px rgba(255,255,255,0.3);
}
.runner-btn.active i { color: inherit; }

/* 버튼 내부 아이콘 색상 */
.runner-btn.color-0 i { color: #ff6b6b; }
.runner-btn.color-1 i { color: #48dbfb; }
.runner-btn.color-2 i { color: #1dd1a1; }
.runner-btn.color-3 i { color: #feca57; }
.runner-btn.color-4 i { color: #ff9ff3; }

.btn-start {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #ff512f, #dd2476);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(221, 36, 118, 0.4);
  transition: transform 0.2s;
}
.btn-start:disabled {
  background: #555;
  box-shadow: none;
  cursor: not-allowed;
}
.btn-start:active:not(:disabled) { transform: scale(0.98); }

.spinner-small {
  display: inline-block;
  width: 20px; height: 20px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* 결과 모달 */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
  padding: 20px;
}
.modal-content {
  background: white;
  color: #333;
  padding: 30px 20px;
  border-radius: 15px;
  text-align: center;
  width: 100%;
  max-width: 350px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.result-header i { font-size: 4rem; margin-bottom: 15px; display: block; }
.win-icon { color: #f1c40f; text-shadow: 0 0 10px #f1c40f; }
.lose-icon { color: #95a5a6; }

.win-title { color: #2ecc71; margin: 0 0 20px; }
.lose-title { color: #7f8c8d; margin: 0 0 20px; }

.result-details {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 25px;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 1.1rem;
}
.detail-row:last-child { margin-bottom: 0; }
.text-runner-0 { color: #ff6b6b; }
.text-runner-1 { color: #48dbfb; }
.text-runner-2 { color: #1dd1a1; }
.text-runner-3 { color: #feca57; }
.text-runner-4 { color: #ff9ff3; }
.win-amount { color: #f1c40f; font-size: 1.2rem; }
.lose-desc { color: #7f8c8d; margin: 0; }

.modal-actions { display: flex; gap: 10px; }
.btn-retry, .btn-exit {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1rem;
}
.btn-retry { background: #3498db; color: white; }
.btn-exit { background: #ecf0f1; color: #333; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes pulse { 0% { opacity: 0.8; } 50% { opacity: 1; } 100% { opacity: 0.8; } }
</style>