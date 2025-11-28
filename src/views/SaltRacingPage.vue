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

      <div class="track-scroll-wrapper" ref="trackScrollWrapper">
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
                <div class="runner-body">
                  <div class="runner-img-box" :class="{ 'selected': selectedRunner === index }">
                    <img :src="runnerImages[index]" class="runner-img" alt="runner" />
                    <div v-if="selectedRunner === index" class="selected-marker">
                        <i class="fas fa-caret-down"></i>
                    </div>
                  </div>
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
        <p>달려라! {{ selectedRunner + 1 }}번 선수!</p>
      </div>

      <div class="control-panel" v-if="gameStatus === 'idle'">
        
        <div class="panel-section">
          <h4>우승 후보 선택 <small>(배당 4.5배)</small></h4>
          <div class="runner-buttons">
            <button 
              v-for="(img, i) in runnerImages" 
              :key="i"
              @click="selectedRunner = i"
              :class="['runner-btn', { active: selectedRunner === i }]"
            >
              <div class="btn-img-wrapper">
                <img :src="img" class="btn-runner-img" />
              </div>
              <span>{{ i + 1 }}번</span>
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
        
        <div class="result-visual">
            <img :src="runnerImages[resultData.winnerIndex]" class="winner-img" />
        </div>

        <div class="result-details">
          <div class="detail-row">
            <span>우승 선수</span>
            <strong class="text-highlight">{{ resultData.winnerIndex + 1 }}번 선수</strong>
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

// 이미지 임포트
import runner1 from '@/assets/racing/runner1.png';
import runner2 from '@/assets/racing/runner2.png';
import runner3 from '@/assets/racing/runner3.png';
import runner4 from '@/assets/racing/runner4.png';
import runner5 from '@/assets/racing/runner5.png';

const runnerImages = [runner1, runner2, runner3, runner4, runner5];

const router = useRouter();

// --- 상태 변수 ---
const userPoints = ref(0);
const todayPlayCount = ref(0);
const gameStatus = ref('idle'); 
const isProcessing = ref(false);

const runners = reactive(Array.from({ length: 5 }, () => ({ progress: 0, rank: null })));
const selectedRunner = ref(null); 
const selectedBet = ref(100);
const allowedBets = [100, 300, 500, 800];

const resultData = ref(null);
let animationFrameId = null;

// --- [수정 2] 스크롤 제어를 위한 ref ---
const trackScrollWrapper = ref(null);

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

  unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
    if (docSnap.exists()) {
      userPoints.value = docSnap.data().saltmatePoints || 0;
    }
  });

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
    const result = await playRacingFunc({
      betAmount: selectedBet.value,
      selectedRunner: selectedRunner.value
    });
    
    resultData.value = result.data; 
    gameStatus.value = 'racing';
    isProcessing.value = false;
    
    // 스크롤 초기화
    if (trackScrollWrapper.value) {
        trackScrollWrapper.value.scrollLeft = 0;
    }

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
  runners.forEach(r => { r.progress = 0; r.rank = null; });

  let finishedCount = 0;
  const speeds = runners.map(() => 0.3 + Math.random() * 0.2); 

  const animate = () => {
    let maxProgress = 0; // [수정 2] 선두 주자의 위치 추적용

    runners.forEach((runner, index) => {
      if (runner.progress < 100) {
        // 랜덤 속도
        if (Math.random() < 0.05) speeds[index] = 0.2 + Math.random() * 0.5;
        
        // 승부 조작 (80% 지점부터)
        if (runner.progress > 80) {
           if (index === winnerIndex) {
               speeds[index] += 0.05; 
           } else if (runners[winnerIndex].progress < 100) {
               speeds[index] *= 0.9; 
           }
        }

        runner.progress += speeds[index];

        if (runner.progress >= 100) {
          runner.progress = 100;
          if (!runner.rank) {
            finishedCount++;
            runner.rank = finishedCount;
          }
        }
      }
      // 선두 주자 위치 갱신
      if (runner.progress > maxProgress) maxProgress = runner.progress;
    });

    // ▼▼▼ [수정 2] 모바일에서 1등을 따라가도록 자동 스크롤 (PC에서는 CSS로 스크롤 제거됨) ▼▼▼
    if (trackScrollWrapper.value) {
        const wrapper = trackScrollWrapper.value;
        const scrollWidth = wrapper.scrollWidth;
        const clientWidth = wrapper.clientWidth;
        
        // 스크롤이 필요한 경우(모바일 등 화면보다 컨텐츠가 클 때)에만 작동
        if (scrollWidth > clientWidth) {
            // 선두 주자의 % 위치를 픽셀로 변환하여 스크롤 위치 계산
            // (화면의 60% 지점에 선두가 오도록 조정)
            const targetScroll = (maxProgress / 100) * scrollWidth - (clientWidth * 0.6);
            
            // 부드럽게 이동 (기존 위치와 목표 위치 보간)
            wrapper.scrollLeft += (targetScroll - wrapper.scrollLeft) * 0.1;
        }
    }
    // ▲▲▲

    if (finishedCount < 5) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      setTimeout(() => {
        gameStatus.value = 'finished';
      }, 800);
    }
  };

  animationFrameId = requestAnimationFrame(animate);
};

const resetGame = () => {
  gameStatus.value = 'idle';
  selectedRunner.value = null;
  runners.forEach(r => { r.progress = 0; r.rank = null; });
  resultData.value = null;
  
  // 스크롤 초기화
  if (trackScrollWrapper.value) {
      trackScrollWrapper.value.scrollLeft = 0;
  }
};
</script>

<style scoped>
/* 전체 페이지 */
.racing-page {
  min-height: 100dvh;
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
  max-width: 700px; /* [수정] 게임 컨테이너와 동일한 너비로 변경 (기존 500px -> 700px) */
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 10px 15px;
  border-radius: 12px;
  margin-bottom: 15px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0; 
}
.stat-item { text-align: center; }
.stat-item span { display: block; font-size: 0.8rem; color: #ccc; margin-bottom: 2px; }
.stat-item strong { font-size: 1.1rem; color: #FFD700; }

/* 게임 컨테이너 */
.game-container {
  width: 100%;
  max-width: 700px; /* [수정] PC에서 넉넉하게 보이도록 너비 유지 */
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 15px;
  padding: 15px; 
  display: flex;
  flex-direction: column;
  gap: 15px;
  max-height: calc(100vh - 120px); 
  overflow-y: auto;
}

.game-header { text-align: center; flex-shrink: 0; }
.game-header h2 { color: #FFD700; margin: 0 0 5px; font-size: 1.4rem; }
.sub-text { color: #bdc3c7; font-size: 0.85rem; margin: 0; }

/* [핵심] 트랙 스크롤 래퍼 */
.track-scroll-wrapper {
  width: 100%;
  overflow-x: auto; /* 모바일: 가로 스크롤 허용 */
  border-radius: 10px;
  background: #333;
  border: 2px solid #555;
  flex-shrink: 0;
}

/* ▼▼▼ [수정 3] PC에서는 스크롤 없이 100% 너비 사용 및 스크롤바 제거 ▼▼▼ */
@media (min-width: 769px) {
    .track-scroll-wrapper {
        overflow-x: hidden; /* PC 스크롤 제거 */
    }
    .track-container {
        min-width: auto !important; /* [수정] 800px 강제 너비 해제 (컨테이너에 맞춤) */
        width: 100%;
    }
}
/* ▲▲▲ */

/* 실제 트랙 컨테이너 */
.track-container {
  min-width: 800px; /* [수정] 모바일에서는 길게 (스크롤 발생 유도) */
  padding: 10px 50px 10px 10px; 
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
  top: 0; bottom: 0; right: 30px;
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

/* 레인 */
.lane {
  display: flex;
  align-items: center;
  height: 60px; /* [수정] 레인 높이 확보 */
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
  margin-right: 5px;
}

.runner-track {
  flex-grow: 1;
  position: relative;
  height: 100%;
}

/* 달리는 선수 */
.runner {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  transition: left 0.1s linear;
  z-index: 1;
  margin-left: -25px; 
}

.runner-body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* [수정 1] 원형 배경 및 테두리 제거 (투명 처리) */
.runner-img-box {
  width: 50px; 
  height: 50px;
  /* background: rgba(255,255,255,0.1); <-- 배경 삭제 */
  /* border: 2px solid rgba(255,255,255,0.3); <-- 테두리 삭제 */
  /* border-radius: 50%; */
  overflow: visible; /* 그림자 등이 잘리지 않게 */
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.selected-marker {
    position: absolute;
    top: -15px;
    color: #FFD700;
    font-size: 1.2rem;
    animation: bounce 1s infinite;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));
}
@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
}

/* 이미지만 렌더링 */
.runner-img {
  width: 100%; 
  height: 100%; 
  object-fit: contain; /* 비율 유지하며 표시 */
  filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.5)); /* 그림자 추가로 입체감 */
}

/* 우승 시 효과 (이미지 확대) */
.runner.is-winner .runner-img {
  transform: scale(1.3);
  filter: drop-shadow(0 0 10px gold);
}

.runner-label {
  position: absolute;
  bottom: -12px;
  font-size: 0.6rem;
  color: #fff;
  background: rgba(0,0,0,0.6);
  padding: 1px 4px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0.8;
}

.rank-badge {
  position: absolute;
  top: -5px;
  right: -10px;
  background: #fff;
  color: #000;
  font-weight: bold;
  font-size: 0.7rem;
  padding: 1px 5px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  animation: pop 0.3s;
  z-index: 5;
}

/* 컨트롤 패널 */
.control-panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 15px;
  flex-shrink: 0;
}
.panel-section { margin-bottom: 15px; }
.panel-section h4 { 
  margin: 0 0 10px 0; 
  color: #ddd; 
  font-size: 0.95rem; 
  text-align: center;
}
.panel-section h4 small { color: #888; font-weight: normal; }

.runner-buttons, .amount-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.runner-btn {
  flex: 1 1 18%;
  min-width: 55px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.1);
  color: #ccc;
  padding: 8px 5px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}
.btn-img-wrapper {
  width: 35px; height: 35px;
  /* 버튼 안의 이미지는 원형 유지 (선택용) */
  border-radius: 50%;
  overflow: hidden;
  background: rgba(0,0,0,0.2);
}
.btn-runner-img {
  width: 100%; height: 100%; object-fit: cover;
}
.runner-btn.active {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-weight: bold;
  border-color: #FFD700;
  transform: scale(1.05);
  box-shadow: 0 0 10px rgba(255,215,0,0.3);
}

.amount-buttons button {
  flex: 1 1 22%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ccc;
  padding: 8px 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}
.amount-buttons button.active {
  background: #fff;
  color: #333;
  font-weight: bold;
  border-color: #fff;
}

.btn-start {
  width: 100%;
  padding: 12px;
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

.racing-message-box {
  text-align: center;
  background: rgba(0,0,0,0.3);
  padding: 15px;
  border-radius: 10px;
  animation: pulse 1.5s infinite;
  margin-bottom: 10px;
}

/* 결과 모달 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  justify-content: center;
  align-items: center;
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
.result-visual {
  width: 100px; height: 100px;
  margin: 0 auto 15px;
  /* 결과창에서는 원형 유지 또는 제거 선택 가능 (여기선 유지) */
  /* border-radius: 50%; */
  overflow: visible;
  /* border: 4px solid #FFD700; */
  /* box-shadow: 0 0 15px rgba(255, 215, 0, 0.5); */
}
.winner-img { 
    width: 100%; height: 100%; object-fit: contain; 
    filter: drop-shadow(0 5px 10px rgba(0,0,0,0.3));
}

.win-title { color: #2ecc71; margin: 0 0 10px; }
.lose-title { color: #7f8c8d; margin: 0 0 10px; }

.result-details {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 1.1rem;
}
.text-highlight { color: #007bff; }
.win-amount { color: #f1c40f; font-size: 1.2rem; }

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

.spinner-small {
  display: inline-block;
  width: 20px; height: 20px;
  border: 3px solid rgba(255,255,255,0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes pulse { 0% { opacity: 0.8; } 50% { opacity: 1; } 100% { opacity: 0.8; } }
</style>