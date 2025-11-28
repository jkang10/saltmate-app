<template>
  <div class="racing-page">
    
    <!-- 모드 선택 화면 (초기 진입 시) -->
    <div v-if="!selectedMode" class="mode-selection-overlay">
      <div class="mode-card" @click="selectMode('individual')">
        <i class="fas fa-user"></i>
        <h3>개인 레이스</h3>
        <p>혼자서 즐기는 스피드! 언제든지 바로 시작하세요.</p>
      </div>
      <div class="mode-card family" @click="selectMode('family')">
        <i class="fas fa-users"></i>
        <h3>솔트메이트 가족 레이스</h3>
        <p>5분마다 열리는 대박 찬스! 총 상금의 주인공이 되세요.</p>
        <div class="live-badge">LIVE</div>
      </div>
    </div>

    <!-- 상단 스탯 -->
    <div class="game-stats-glass" v-if="selectedMode">
      <button class="back-btn" @click="goBack"><i class="fas fa-arrow-left"></i></button>
      <div class="stat-item">
        <span>보유 포인트</span>
        <strong>{{ (userPoints || 0).toLocaleString() }} P</strong>
      </div>
      <div class="stat-item" v-if="selectedMode === 'individual'">
        <span>남은 횟수</span>
        <strong>{{ 20 - todayPlayCount }} / 20</strong>
      </div>
      <div class="stat-item family-pot" v-if="selectedMode === 'family'">
        <span>현재 총 상금</span>
        <strong>{{ (familyRaceState.totalPot || 0).toLocaleString() }} P</strong>
      </div>
    </div>

    <!-- 게임 컨테이너 -->
    <div class="game-container card glassmorphism" v-if="selectedMode">
      <header class="game-header">
        <h2 v-if="selectedMode === 'individual'"><i class="fas fa-flag-checkered"></i> 개인 레이스</h2>
        <h2 v-else class="family-title"><i class="fas fa-globe"></i> 가족 레이스 <small>(수수료 10%)</small></h2>
        
        <p v-if="selectedMode === 'family'" class="timer-text">
          <!-- 경기 중일 때는 타이머 대신 상태 표시 -->
          <span v-if="gameStatus === 'racing' || gameStatus === 'finished'" class="racing-text">RACING NOW!</span>
          <span v-else>다음 경기까지: <span>{{ familyTimer }}</span></span>
        </p>
      </header>

      <!-- 트랙 영역 -->
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
                  <!-- 가족 레이스일 때 실시간 배당률 표시 -->
                  <span v-if="selectedMode === 'family'" class="runner-odds">
                    {{ calculateOdds(index) }}배
                  </span>
                  <span v-else class="runner-label">{{ index + 1 }}번</span>
                </div>
                <div v-if="runner.rank" class="rank-badge">
                  {{ runner.rank }}등
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 상태 메시지 -->
      <div v-if="gameStatus === 'racing'" class="racing-message-box">
        <h3><i class="fas fa-running"></i> 경기 진행 중...</h3>
        <p>달려라! {{ selectedRunner + 1 }}번 선수!</p>
      </div>
      
      <!-- 가족 레이스 베팅 정보 표시 -->
      <div v-if="selectedMode === 'family' && hasBetFamily" class="my-bet-info">
        <p>
          <span class="round-badge">Round {{ familyRaceState.roundId }}</span>
          나의 베팅: <strong>{{ myFamilyBet.amount }} P</strong> ({{ myFamilyBet.runner + 1 }}번 선수)
        </p>
      </div>

      <!-- 컨트롤 패널 -->
      <div class="control-panel" v-if="gameStatus === 'idle'">
        <div class="panel-section">
          <h4>우승 후보 선택 <small v-if="selectedMode === 'individual'">(배당 4.5배)</small></h4>
          <div class="runner-buttons">
            <button 
              v-for="(img, i) in runnerImages" 
              :key="i"
              @click="selectedRunner = i"
              :class="['runner-btn', { active: selectedRunner === i }]"
              :disabled="selectedMode === 'family' && hasBetFamily"
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
              :disabled="userPoints < amount || (selectedMode === 'family' && hasBetFamily)"
            >
              {{ amount }} P
            </button>
          </div>
        </div>

        <button 
          class="btn-start" 
          @click="handleStart" 
          :disabled="selectedRunner === null || !selectedBet || isProcessing || (selectedMode === 'family' && hasBetFamily)"
        >
          <span v-if="isProcessing" class="spinner-small"></span>
          <span v-else-if="selectedMode === 'family' && hasBetFamily">베팅 완료 (경기 대기 중)</span>
          <span v-else>{{ selectedMode === 'individual' ? '경기 시작하기' : '베팅 하기' }}</span>
        </button>
      </div>
    </div>

    <!-- 결과 모달 -->
    <div v-if="gameStatus === 'finished' && resultData" class="modal-overlay">
      <div class="modal-content">
        <div class="result-header">
          <i v-if="resultData.isWin" class="fas fa-trophy win-icon"></i>
          <i v-else class="fas fa-sad-tear lose-icon"></i>
        </div>
        
        <h2 v-if="resultData.isWin" class="win-title">축하합니다!</h2>
        <h2 v-else class="lose-title">아쉬운 패배...</h2>
        
        <div v-if="resultData.missed" class="missed-msg">
            (지난 경기 결과)
        </div>
        
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
          <button @click="resetGame" class="btn-retry">
            {{ selectedMode === 'family' ? '다음 라운드 대기' : '한 번 더 도전!' }}
          </button>
          <button @click="router.push('/dashboard')" class="btn-exit">나가기</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// [수정] unused import 제거 (watch 삭제)
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
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
const route = useRoute();

// --- 상태 변수 ---
const selectedMode = ref(null); 
const userPoints = ref(0);
const todayPlayCount = ref(0);
const gameStatus = ref('idle'); 
const isProcessing = ref(false);
const runners = reactive(Array.from({ length: 5 }, () => ({ progress: 0, rank: null })));
const selectedRunner = ref(null); 
const selectedBet = ref(100);
const allowedBets = [100, 300, 500, 800];
const resultData = ref(null);
const trackScrollWrapper = ref(null);
let animationFrameId = null;

// --- 가족 레이스 전용 ---
const familyRaceState = ref({});
const familyTimer = ref("00:00");
const hasBetFamily = ref(false);
const myFamilyBet = ref({});
const cachedFamilyBet = ref(null); // DB가 초기화되기 전 베팅 정보를 캐싱
const previousRoundId = ref(null); // 라운드 변경 감지용

let familyUnsubscribe = null;
let myBetUnsubscribe = null;
let timerInterval = null;
let unsubscribeUser = null;
let unsubscribeDaily = null;

onMounted(() => {
  if (route.query.mode === 'family') {
    selectMode('family');
  }

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
  if (familyUnsubscribe) familyUnsubscribe();
  if (myBetUnsubscribe) myBetUnsubscribe();
  if (timerInterval) clearInterval(timerInterval);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

const selectMode = (mode) => {
  selectedMode.value = mode;
  resetGame();
  
  if (mode === 'family') {
    startFamilyListeners();
  } else {
    if (familyUnsubscribe) familyUnsubscribe();
    if (myBetUnsubscribe) myBetUnsubscribe();
  }
};

const goBack = () => {
    selectedMode.value = null;
    resetGame();
    if (familyUnsubscribe) familyUnsubscribe();
    if (myBetUnsubscribe) myBetUnsubscribe();
};

// --- 가족 레이스 로직 ---
const startFamilyListeners = () => {
  const user = auth.currentUser;
  
  // 1. 전체 게임 상태 리스너 (라운드 변경 감지)
  const raceRef = doc(db, 'system', 'saltRacingFamily');
  familyUnsubscribe = onSnapshot(raceRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // 라운드가 변경되었는지 확인 (경기 종료 시점)
      if (previousRoundId.value !== null && data.roundId > previousRoundId.value) {
          // 경기가 막 끝났음 -> 애니메이션 시작
          handleFamilyRaceFinish(data.lastWinner);
      } else {
          // 일반적인 상태 업데이트
          familyRaceState.value = data;
          if (data.nextRaceTime && gameStatus.value !== 'racing') {
            updateTimer(data.nextRaceTime.toDate());
          }
      }
      
      // 혹시 처음 로드했을 때 지난 베팅 결과가 있는지 확인 (5분 지나서 들어온 경우)
      if (previousRoundId.value === null) {
          checkMissedResult(data);
      }

      previousRoundId.value = data.roundId;
    }
  });
  
  // 2. 내 베팅 내역 실시간 리스너 (새로고침/나갔다 와도 유지됨)
  const myBetRef = doc(db, 'system/saltRacingFamily/currentBets', user.uid);
  myBetUnsubscribe = onSnapshot(myBetRef, (docSnap) => {
      if (docSnap.exists()) {
          // 베팅 정보가 있으면 상태 복구
          const data = docSnap.data();
          hasBetFamily.value = true;
          myFamilyBet.value = { amount: data.amount, runner: data.runner };
          selectedRunner.value = data.runner;
          selectedBet.value = data.amount;
          cachedFamilyBet.value = data; // 결과 처리를 위해 캐싱
          
          // 로컬 스토리지에도 백업 (화면 꺼짐 등 대비)
          localStorage.setItem(`familyBet_${familyRaceState.value.roundId}`, JSON.stringify(data));
      } else {
          // 베팅 내역이 없으면 (초기화 됨)
          // 단, 현재 결과 처리 중(racing/finished)이면 상태를 바로 지우지 않음
          if (gameStatus.value === 'idle') {
              hasBetFamily.value = false;
              myFamilyBet.value = {};
          }
      }
  });
};

// 놓친 결과 확인 (5분이 지나서 들어왔을 때)
const checkMissedResult = (currentSystemState) => {
    const lastRoundId = currentSystemState.roundId - 1;
    const storedBet = localStorage.getItem(`familyBet_${lastRoundId}`);
    
    if (storedBet && currentSystemState.lastWinner !== null) {
        const betInfo = JSON.parse(storedBet);
        const isWin = (betInfo.runner === currentSystemState.lastWinner);
        // [수정] 사용하지 않는 변수 prizePool 제거
        
        // 결과 모달 띄우기
        resultData.value = {
            winnerIndex: currentSystemState.lastWinner,
            isWin: isWin,
            winnings: isWin ? '정산 완료' : 0,
            missed: true // "지난 경기 결과" 표시용
        };
        gameStatus.value = 'finished';
        
        // 확인 후 스토리지 삭제
        localStorage.removeItem(`familyBet_${lastRoundId}`);
    }
};

// 라운드 변경 시 실행 (애니메이션 -> 결과)
const handleFamilyRaceFinish = (winnerIndex) => {
    // 1. 타이머 멈춤 및 상태 변경
    if (timerInterval) clearInterval(timerInterval);
    gameStatus.value = 'racing';
    
    // 2. 내 베팅 정보 가져오기 (DB는 이미 지워졌을 수 있으므로 캐시나 스토리지 사용)
    let myBet = cachedFamilyBet.value;
    if (!myBet) {
        const stored = localStorage.getItem(`familyBet_${previousRoundId.value}`);
        if (stored) myBet = JSON.parse(stored);
    }

    // 3. 애니메이션 시작
    startRaceAnimation(winnerIndex, () => {
        // 애니메이션 종료 후 콜백
        if (myBet) {
            const isWin = (myBet.runner === winnerIndex);
            resultData.value = {
                winnerIndex: winnerIndex,
                isWin: isWin,
                winnings: isWin ? '정산 완료' : 0 // 금액은 이미 서버가 지급함
            };
            // 스토리지 정리
            localStorage.removeItem(`familyBet_${previousRoundId.value}`);
        } else {
            // 베팅 안 했어도 결과는 보여줌
            resultData.value = {
                winnerIndex: winnerIndex,
                isWin: false,
                winnings: 0
            };
        }
        gameStatus.value = 'finished';
    });
};

const updateTimer = (targetDate) => {
  if (timerInterval) clearInterval(timerInterval);
  
  const tick = () => {
    const diff = targetDate - new Date();
    if (diff <= 0) {
      familyTimer.value = "경기 준비 중...";
    } else {
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      familyTimer.value = `${m}:${s < 10 ? '0'+s : s}`;
    }
  };
  
  tick(); // 즉시 실행
  timerInterval = setInterval(tick, 1000);
};

const calculateOdds = (index) => {
  const total = familyRaceState.value.totalPot || 0;
  const runnerBet = familyRaceState.value.bets?.[index] || 0;
  if (runnerBet === 0) return '-';
  return ((total * 0.9) / runnerBet).toFixed(2);
};

// --- 게임 실행 로직 ---
const handleStart = () => {
  if (selectedMode.value === 'individual') {
    startIndividualRace();
  } else {
    placeFamilyBet();
  }
};

const playRacingFunc = httpsCallable(functions, 'playSaltRacing');
const startIndividualRace = async () => {
  if (selectedRunner.value === null) return;
  if (todayPlayCount.value >= 20) {
    alert("오늘은 더 이상 경기에 참여할 수 없습니다.");
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
    
    if (trackScrollWrapper.value) trackScrollWrapper.value.scrollLeft = 0;
    
    startRaceAnimation(result.data.winnerIndex, () => {
        gameStatus.value = 'finished';
    });
  } catch (error) {
    console.error("게임 시작 오류:", error);
    let msg = error.message;
    if(msg.includes("resource-exhausted")) msg = "일일 참여 횟수를 초과했습니다.";
    alert(msg);
    isProcessing.value = false;
  }
};

const placeFamilyBetFunc = httpsCallable(functions, 'placeFamilyRaceBet');
const placeFamilyBet = async () => {
  if (!confirm(`${selectedBet.value} P를 ${selectedRunner.value + 1}번 선수에게 베팅하시겠습니까?`)) return;
  
  isProcessing.value = true;
  try {
    await placeFamilyBetFunc({ betAmount: selectedBet.value, selectedRunner: selectedRunner.value });
    // UI 즉시 반영 (리스너가 덮어쓰겠지만 반응성을 위해)
    hasBetFamily.value = true;
    myFamilyBet.value = { amount: selectedBet.value, runner: selectedRunner.value };
    // 캐싱 (결과 확인용)
    cachedFamilyBet.value = { amount: selectedBet.value, runner: selectedRunner.value };
    
    alert("베팅이 완료되었습니다! 경기 시간에 결과를 확인하세요.");
  } catch (e) {
    alert(e.message);
  } finally {
    isProcessing.value = false;
  }
};

// 애니메이션 (콜백 추가)
const startRaceAnimation = (winnerIndex, onComplete) => {
  runners.forEach(r => { r.progress = 0; r.rank = null; });

  let finishedCount = 0;
  const speeds = runners.map(() => 0.3 + Math.random() * 0.2); 

  const animate = () => {
    let maxProgress = 0;

    runners.forEach((runner, index) => {
      if (runner.progress < 100) {
        if (Math.random() < 0.05) speeds[index] = 0.2 + Math.random() * 0.5;
        
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
      if (runner.progress > maxProgress) maxProgress = runner.progress;
    });

    // PC 스크롤 제거되었으므로 모바일에서만 작동하도록 조건 강화해도 됨
    if (trackScrollWrapper.value) {
        const wrapper = trackScrollWrapper.value;
        const scrollWidth = wrapper.scrollWidth;
        const clientWidth = wrapper.clientWidth;
        if (scrollWidth > clientWidth) {
            const targetScroll = (maxProgress / 100) * scrollWidth - (clientWidth * 0.6);
            wrapper.scrollLeft += (targetScroll - wrapper.scrollLeft) * 0.1;
        }
    }

    if (finishedCount < 5) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      setTimeout(() => {
        if (onComplete) onComplete();
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
  cachedFamilyBet.value = null; // 결과 확인 후 캐시 초기화
  hasBetFamily.value = false;
  
  if (trackScrollWrapper.value) trackScrollWrapper.value.scrollLeft = 0;
  
  // 가족 모드라면 최신 타이머 다시 로드
  if (selectedMode.value === 'family' && familyRaceState.value.nextRaceTime) {
      updateTimer(familyRaceState.value.nextRaceTime.toDate());
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
  max-width: 700px; 
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 10px 15px;
  border-radius: 12px;
  margin-bottom: 15px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0; 
  position: relative;
}
.stat-item { text-align: center; }
.stat-item span { display: block; font-size: 0.8rem; color: #ccc; margin-bottom: 2px; }
.stat-item strong { font-size: 1.1rem; color: #FFD700; }

/* 게임 컨테이너 */
.game-container {
  width: 100%;
  max-width: 700px;
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

/* 트랙 스크롤 래퍼 */
.track-scroll-wrapper {
  width: 100%;
  overflow-x: auto;
  border-radius: 10px;
  background: #333;
  border: 2px solid #555;
  flex-shrink: 0;
}

/* [핵심 수정] PC 화면(769px 이상)에서 스크롤 제거 및 너비 100% 강제 */
@media (min-width: 769px) {
    .track-scroll-wrapper { overflow-x: hidden; }
    .track-container { min-width: 100% !important; width: 100%; }
}

.track-container {
  min-width: 800px; /* 모바일에서만 적용됨 */
  padding: 10px 50px 10px 10px; 
  position: relative;
  background: repeating-linear-gradient(90deg, #2c3e50, #2c3e50 50px, #34495e 50px, #34495e 100px);
}

.finish-line {
  position: absolute; top: 0; bottom: 0; right: 30px; width: 8px; z-index: 0;
  display: flex; flex-direction: column; align-items: center;
}
.finish-line-bar {
  width: 100%; height: 100%;
  background: repeating-linear-gradient(0deg, #fff, #fff 10px, #000 10px, #000 20px);
  border: 1px solid #fff;
}
.finish-flag { position: absolute; top: -20px; font-size: 1.2rem; color: #fff; }

.lane {
  display: flex; align-items: center; height: 60px;
  border-bottom: 1px dashed rgba(255,255,255,0.2); position: relative;
}
.lane:last-child { border-bottom: none; }

.lane-number {
  width: 20px; font-weight: bold; color: #aaa; font-size: 0.8rem; text-align: center; margin-right: 5px;
}

.runner-track { flex-grow: 1; position: relative; height: 100%; }

.runner {
  position: absolute; top: 50%; transform: translateY(-50%); transition: left 0.1s linear; z-index: 1; margin-left: -25px; 
}

.runner-body {
  position: relative; display: flex; flex-direction: column; align-items: center;
}

.runner-img-box {
  width: 50px; height: 50px; overflow: visible;
  display: flex; justify-content: center; align-items: center; position: relative;
}

.selected-marker {
    position: absolute; top: -15px; color: #FFD700; font-size: 1.2rem;
    animation: bounce 1s infinite; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));
}
@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

.runner-img {
  width: 100%; height: 100%; object-fit: contain; 
  filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.5));
}

.runner.is-winner .runner-img { transform: scale(1.3); filter: drop-shadow(0 0 10px gold); }

.runner-label {
  position: absolute; bottom: -12px; font-size: 0.6rem; color: #fff;
  background: rgba(0,0,0,0.6); padding: 1px 4px; border-radius: 4px; white-space: nowrap; opacity: 0.8;
}

.rank-badge {
  position: absolute; top: -5px; right: -10px;
  background: #fff; color: #000; font-weight: bold; font-size: 0.7rem;
  padding: 1px 5px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  animation: pop 0.3s; z-index: 5;
}

/* 컨트롤 패널 */
.control-panel {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 15px;
  flex-shrink: 0;
}
.panel-section { margin-bottom: 15px; }
.panel-section h4 { margin: 0 0 10px 0; color: #ddd; font-size: 0.95rem; text-align: center; }
.panel-section h4 small { color: #888; font-weight: normal; }

.runner-buttons, .amount-buttons {
  display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;
}

.runner-btn {
  flex: 1 1 18%; min-width: 55px;
  background: rgba(255, 255, 255, 0.1); border: 2px solid rgba(255, 255, 255, 0.1);
  color: #ccc; padding: 8px 5px; border-radius: 8px; cursor: pointer;
  font-size: 0.8rem; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: all 0.2s;
}
.btn-img-wrapper {
  width: 35px; height: 35px; border-radius: 50%; overflow: hidden; background: rgba(0,0,0,0.2);
}
.btn-runner-img { width: 100%; height: 100%; object-fit: cover; }
.runner-btn.active {
  background: rgba(255, 255, 255, 0.2); color: #fff; font-weight: bold;
  border-color: #FFD700; transform: scale(1.05); box-shadow: 0 0 10px rgba(255,215,0,0.3);
}

.amount-buttons button {
  flex: 1 1 22%; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ccc; padding: 8px 0; border-radius: 6px; cursor: pointer; font-size: 0.9rem;
}
.amount-buttons button.active {
  background: #fff; color: #333; font-weight: bold; border-color: #fff;
}

.btn-start {
  width: 100%; padding: 12px; background: linear-gradient(135deg, #ff512f, #dd2476);
  color: white; border: none; border-radius: 10px; font-size: 1.1rem; font-weight: bold;
  cursor: pointer; box-shadow: 0 4px 15px rgba(221, 36, 118, 0.4); transition: transform 0.2s;
}
.btn-start:disabled { background: #555; box-shadow: none; cursor: not-allowed; }
.btn-start:active:not(:disabled) { transform: scale(0.98); }

.racing-message-box {
  text-align: center; background: rgba(0,0,0,0.3); padding: 15px;
  border-radius: 10px; animation: pulse 1.5s infinite; margin-bottom: 10px;
}

/* 모드 선택 오버레이 */
.mode-selection-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 2000;
  display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 20px;
}
.mode-card {
  background: #2c3e50; width: 80%; max-width: 300px; padding: 30px;
  border-radius: 20px; text-align: center; cursor: pointer;
  border: 2px solid rgba(255,255,255,0.1); transition: all 0.2s; position: relative;
}
.mode-card:hover { transform: scale(1.05); border-color: #00c6ff; }
.mode-card i { font-size: 3rem; margin-bottom: 15px; color: #ccc; }
.mode-card h3 { color: #fff; margin-bottom: 10px; }
.mode-card p { color: #aaa; font-size: 0.9rem; }

.mode-card.family {
  background: linear-gradient(135deg, #1a2980, #26d0ce); border-color: #26d0ce;
}
.mode-card.family i { color: #fff; }
.live-badge {
  position: absolute; top: 10px; right: 10px;
  background: #ff0055; color: white; padding: 2px 8px;
  border-radius: 10px; font-size: 0.7rem; font-weight: bold; animation: pulse 1s infinite;
}

/* 가족 레이스 전용 스타일 */
.family-title { color: #26d0ce !important; }
.timer-text { font-size: 1.1rem; color: #fff; text-align: center; margin-bottom: 5px; }
.timer-text span { color: #ff0055; font-weight: bold; font-family: monospace; font-size: 1.3rem; }
.racing-text { color: #00ff88; font-weight: bold; animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: 0.5; } }

.runner-odds {
  position: absolute; top: -20px; right: 0;
  background: rgba(0,0,0,0.7); color: #ffd700;
  font-size: 0.7rem; padding: 2px 5px; border-radius: 4px;
}
.my-bet-info {
  text-align: center; background: rgba(38, 208, 206, 0.2);
  padding: 10px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #26d0ce;
}
.round-badge {
    background: #26d0ce; color: #333; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; margin-right: 5px;
}
.stat-item.family-pot strong { color: #26d0ce; font-size: 1.2rem; }
.back-btn { background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; position: absolute; left: 15px; top: 50%; transform: translateY(-50%); }

/* 결과 모달 */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.85);
  display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px;
}
.modal-content {
  background: white; color: #333; padding: 30px 20px; border-radius: 15px;
  text-align: center; width: 100%; max-width: 350px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.result-visual { width: 100px; height: 100px; margin: 0 auto 15px; overflow: visible; }
.winner-img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.3)); }
.win-title { color: #2ecc71; margin: 0 0 10px; }
.lose-title { color: #7f8c8d; margin: 0 0 10px; }
.missed-msg { color: #888; font-size: 0.9rem; margin-bottom: 10px; }
.result-details { background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px; }
.detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 1.1rem; }
.text-highlight { color: #007bff; }
.win-amount { color: #f1c40f; font-size: 1.2rem; }
.modal-actions { display: flex; gap: 10px; }
.btn-retry, .btn-exit { flex: 1; padding: 12px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1rem; }
.btn-retry { background: #3498db; color: white; }
.btn-exit { background: #ecf0f1; color: #333; }
.spinner-small {
  display: inline-block; width: 20px; height: 20px;
  border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid #fff;
  border-radius: 50%; animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes pulse { 0% { opacity: 0.8; } 50% { opacity: 1; } 100% { opacity: 0.8; } }
</style>