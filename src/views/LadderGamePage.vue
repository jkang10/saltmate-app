<template>
  <div class="ladder-game-page">
    <div class="game-container card">
      <header class="game-header">
        <h1><i class="fas fa-stream"></i> 운명의 사다리타기</h1>
        <p>참가비를 내고 원하는 시작점을 선택하세요! 결과는 신도 모릅니다.</p>
      </header>
      
      <div class="ladder-wrapper">
        <canvas ref="ladderCanvas" class="ladder-canvas"></canvas>
        <div class="start-points">
          <div v-for="n in NUM_LEGS" :key="n" 
               class="point start" 
               :class="{active: selectedEntry === n, disabled: gameStarted}"
               @click="selectStart(n)"
               :style="{ left: `${getPointXPosition(n - 1)}px` }">
            {{ n }}
          </div>
        </div>
        <div class="end-points">
          <div v-for="(result, index) in results" :key="index" 
               class="point end"
               :class="getResultClass(result.prize)"
               :style="{ left: `${getPointXPosition(index)}px` }">
            <transition name="fade">
              <span v-if="gameEnded && finalResultIndex === index">
                {{ result.prize > 0 ? `+${result.prize.toLocaleString()}` : '꽝' }}
              </span>
              <span v-else-if="!gameStarted">?</span>
            </transition>
             <div v-if="gameEnded && finalResultIndex === index && result.prize > 0" class="win-effect-container">
                <div class="confetti" v-for="i in 10" :key="'confetti-'+i" :style="getConfettiStyle()"></div>
                <div class="sparkle" v-for="i in 5" :key="'sparkle-'+i" :style="getSparkleStyle()"></div>
            </div>
            <div v-if="gameEnded && finalResultIndex === index && result.prize <= 0" class="lose-effect">
                <i class="fas fa-times"></i>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!gameStarted" class="setup-controls">
        <p class="cost-info">
          참가비: <strong>100 SaltMate</strong>
        </p>
        <button class="start-button" @click="startGame" :disabled="isLoading || selectedEntry === null">
          <span v-if="isLoading" class="spinner-small"></span>
          <span v-else>결과 확인하기</span>
        </button>
      </div>

      <div v-if="gameEnded" class="results-display">
        <h3>게임 결과</h3>
        <div class="summary">
          <p>총 획득: <span :class="totalWinnings > 0 ? 'win' : 'lose'">{{ totalWinnings.toLocaleString() }} SaltMate</span></p>
          <p>참가비: <span>- 100 SaltMate</span></p>
          <hr/>
          <p>최종 손익: 
            <strong :class="netGain >= 0 ? 'win' : 'lose'">
              {{ netGain >= 0 ? '+' : '' }}{{ netGain.toLocaleString() }} SaltMate
            </strong>
          </p>
        </div>
        <button class="start-button" @click="resetGame">다시하기</button>
      </div>

      <div v-if="error" class="error-message">
        <p>{{ error }}</p>
        <button class="start-button" @click="resetGame">다시 시도</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'; // nextTick 추가
import { httpsCallable, getFunctions } from 'firebase/functions';

const isLoading = ref(false);
const gameStarted = ref(false);
const gameEnded = ref(false);
const results = ref([]); // 서버에서 받은 모든 결과 (숨겨짐)
const error = ref(null);
const selectedEntry = ref(null); // 사용자가 선택한 시작점 (1부터 NUM_LEGS)
const ladderCanvas = ref(null);
const finalResultIndex = ref(null); // 최종 도착한 사다리 번호 (0부터 NUM_LEGS-1)

let ladder = []; // 사다리 가로선 정보
let ctx = null; // 캔버스 context
const NUM_LEGS = 5; // 사다리 세로줄 개수
const LADDER_PADDING_X = 50; // 사다리 좌우 패딩 (캔버스 기준)
const LADDER_WIDTH = computed(() => (ladderCanvas.value ? ladderCanvas.value.getBoundingClientRect().width - LADDER_PADDING_X * 2 : 0));
const LEG_SPACING = computed(() => LADDER_WIDTH.value / (NUM_LEGS - 1)); // 세로줄 간격

const totalWinnings = computed(() => {
    if (!gameEnded.value || finalResultIndex.value === null) return 0;
    const finalResult = results.value[finalResultIndex.value];
    return finalResult ? finalResult.prize : 0;
});
const netGain = computed(() => totalWinnings.value - 100);

const selectStart = (n) => {
  if (gameStarted.value) return;
  selectedEntry.value = n;
};

// [수정] 사다리 세로줄의 X 좌표 계산 (중앙 정렬)
const getLegX = (index) => {
    if (!ladderCanvas.value) return 0;
    // 사다리 전체 폭 내에서 각 세로줄의 X 좌표 계산
    return LADDER_PADDING_X + index * LEG_SPACING.value;
};

// [추가] 시작/끝 점 위치 계산 (세로줄 중앙에 오도록)
const getPointXPosition = (index) => {
    if (!ladderCanvas.value) return 0;
    const canvasWidth = ladderCanvas.value.getBoundingClientRect().width;
    // (캔버스 전체 폭 - 패딩 * 2) / (NUM_LEGS - 1) 로 간격을 계산
    // 그리고 각 점은 그 간격의 절반만큼 중앙에 위치해야 함
    // (index * LEG_SPACING)은 해당 세로줄의 시작점, 여기서 중앙으로 이동
    return LADDER_PADDING_X + index * LEG_SPACING.value - 20; // 20은 point div의 절반 너비 (40px/2)
};


// 캔버스에 사다리 그리기
const drawLadder = () => {
    if (!ladderCanvas.value) return;
    const canvas = ladderCanvas.value;
    ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ced4da'; // 기본 사다리 색상

    // 세로선 그리기
    for (let i = 0; i < NUM_LEGS; i++) {
        ctx.beginPath();
        ctx.moveTo(getLegX(i), 20); // 상단 여백 20
        ctx.lineTo(getLegX(i), rect.height - 20); // 하단 여백 20
        ctx.stroke();
    }
    // 가로선 그리기
    for (const cross of ladder) {
        ctx.beginPath();
        ctx.moveTo(getLegX(cross.from), cross.y);
        ctx.lineTo(getLegX(cross.from + 1), cross.y);
        ctx.stroke();
    }
};

// 사다리 가로선 무작위 생성
const generateLadder = () => {
    ladder = [];
    const height = ladderCanvas.value ? ladderCanvas.value.getBoundingClientRect().height : 300;
    const numCrosses = 7; // 가로선 개수
    const ySpacing = (height - 120) / numCrosses; // 가로선 Y축 간격
    let lastLeg = -2; // 이전에 가로선이 연결된 다리 번호 (겹치지 않게)

    for (let i = 0; i < numCrosses; i++) {
        let from;
        do {
            from = Math.floor(Math.random() * (NUM_LEGS - 1)); // 0부터 NUM_LEGS-2
        } while (from === lastLeg); // 인접한 다리에 가로선이 연속으로 생기지 않도록
        const y = 60 + i * ySpacing + (Math.random() - 0.5) * 10; // Y축 위치 + 약간의 무작위성
        ladder.push({ from, y });
        lastLeg = from;
    }
    drawLadder();
};

// 특정 시작점에서 사다리 타고 내려가서 최종 도착점 계산
const traceLeg = (startLeg) => {
    let currentLeg = startLeg;
    const sortedCrosses = [...ladder].sort((a,b) => a.y - b.y); // Y축 기준으로 정렬
    for (const cross of sortedCrosses) {
        if (cross.from === currentLeg) currentLeg++; // 오른쪽으로 이동
        else if (cross.from + 1 === currentLeg) currentLeg--; // 왼쪽으로 이동
    }
    return currentLeg; // 최종 도착점 인덱스 (0부터 NUM_LEGS-1)
};

// [수정] 선택된 사다리 라인만 애니메이션으로 그리기
const animateTrace = async (startLegIndex) => {
    if (!ctx) return;
    
    // 이전에 그린 사다리 초기화 (선택 라인만 보이도록)
    drawLadder(); // 기존 사다리를 다시 그려서 이전 애니메이션 잔상 제거

    ctx.strokeStyle = '#007bff'; // 애니메이션 라인 색상
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    let currentLeg = startLegIndex;
    let currentY = 20; // 시작 Y 좌표 (캔버스 상단 여백)
    const sortedCrosses = [...ladder].sort((a,b) => a.y - b.y); // Y축 기준으로 정렬

    for (const cross of sortedCrosses) {
        // 현재 Y에서 다음 가로선 Y까지 세로로 이동
        if(cross.y > currentY) {
            await drawLineSegment(getLegX(currentLeg), currentY, getLegX(currentLeg), cross.y);
            currentY = cross.y;
        }

        // 가로선이 현재 다리에 연결되어 있으면 이동
        if (cross.from === currentLeg) {
            await drawLineSegment(getLegX(currentLeg), currentY, getLegX(currentLeg + 1), currentY);
            currentLeg++;
        } else if (cross.from + 1 === currentLeg) {
            await drawLineSegment(getLegX(currentLeg), currentY, getLegX(currentLeg - 1), currentY);
            currentLeg--;
        }
    }
    // 마지막 가로선부터 바닥까지 세로로 이동
    const height = ladderCanvas.value.getBoundingClientRect().height;
    await drawLineSegment(getLegX(currentLeg), currentY, getLegX(currentLeg), height - 20);

    // [추가] 애니메이션 완료 후 최종 결과 공개 및 게임 종료 처리
    finalResultIndex.value = currentLeg; // 최종 도착 다리 인덱스 기록
    setTimeout(() => { gameEnded.value = true; }, 500); // 짧은 딜레이 후 게임 종료 상태로 전환
};

// [수정] 선분 그리기 애니메이션 함수
const drawLineSegment = (x1, y1, x2, y2) => {
    return new Promise(resolve => {
        const duration = 150; // 각 선분 그리는 시간
        const startTime = performance.now();
        const startX = ctx.canvas.width / window.devicePixelRatio; // 현재 캔버스 스케일링 고려

        const animate = (time) => {
            const elapsed = time - startTime;
            let progress = elapsed / duration;
            if (progress > 1) progress = 1;

            ctx.clearRect(0, 0, startX, ctx.canvas.height / window.devicePixelRatio); // 캔버스 전체 초기화
            drawLadder(); // 기본 사다리를 다시 그림 (선택된 라인 외에는 이전에 그린 상태 유지)

            ctx.strokeStyle = '#007bff'; // 애니메이션 라인 색상
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';

            const currentX = x1 + (x2 - x1) * progress;
            const currentY = y1 + (y2 - y1) * progress;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();

            if (progress < 1) requestAnimationFrame(animate);
            else resolve();
        };
        requestAnimationFrame(animate);
    });
};


const startGame = async () => {
  isLoading.value = true;
  error.value = null;
  gameStarted.value = true; // 게임 시작 상태로 변경 (점 선택 비활성화)
  gameEnded.value = false; // 혹시 모를 재시작 시 초기화
  finalResultIndex.value = null; // 최종 결과 인덱스 초기화

  try {
    const functionsWithRegion = getFunctions(undefined, "asia-northeast3");
    const playLadderGame = httpsCallable(functionsWithRegion, 'playLadderGame');
    
    // 서버에서 5개의 모든 다리에 대한 결과 받기
    const response = await playLadderGame({ entryCount: NUM_LEGS }); 
    results.value = response.data.results; // 서버로부터 받은 모든 결과 저장

    // 사용자가 선택한 시작점에서 최종 도착점 계산
    const calculatedFinalLeg = traceLeg(selectedEntry.value - 1); 
    
    // [핵심] 애니메이션 시작
    await animateTrace(selectedEntry.value - 1); // 사용자가 선택한 다리만 애니메이션

  } catch (err) {
    console.error("사다리타기 게임 오류:", err);
    error.value = err.message || "게임 플레이 중 오류가 발생했습니다.";
    gameStarted.value = false; // 오류 발생 시 게임 시작 상태 초기화
  } finally {
    isLoading.value = false;
  }
};

const resetGame = async () => {
  isLoading.value = false;
  gameStarted.value = false;
  gameEnded.value = false;
  results.value = [];
  error.value = null;
  selectedEntry.value = null;
  finalResultIndex.value = null; // 최종 결과 인덱스 초기화
  await nextTick(); // DOM 업데이트를 기다린 후 캔버스 다시 그리기
  generateLadder(); // 새 사다리 생성
  drawLadder(); // 캔버스 초기화 및 사다리 그리기
};

// [수정] 결과에 따른 클래스 (최종 결과만 적용)
const getResultClass = (prize) => {
    if (!gameEnded.value || finalResultIndex.value === null) return '';
    if (prize > 100) return 'win-high'; // 화려한 당첨
    if (prize > 0) return 'win-low'; // 일반 당첨
    return 'lose'; // 꽝
};

// [추가] 당첨 이펙트 - 색종이 스타일
const getConfettiStyle = () => {
  const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '# #4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
  const size = Math.random() * 8 + 4; // 4px to 12px
  const duration = Math.random() * 1.5 + 1; // 1s to 2.5s
  const delay = Math.random() * 0.8;
  const x = Math.random() * 100 - 50; // -50% to 50% from center
  const y = Math.random() * 100 - 50;
  const rotation = Math.random() * 360;

  return {
    'background-color': colors[Math.floor(Math.random() * colors.length)],
    width: `${size}px`,
    height: `${size}px`,
    transform: `translate(${x}%, ${y}%) rotate(${rotation}deg)`,
    'animation-duration': `${duration}s`,
    'animation-delay': `${delay}s`,
  };
};

// [추가] 당첨 이펙트 - 반짝이 스타일
const getSparkleStyle = () => {
  const size = Math.random() * 10 + 5; // 5px to 15px
  const duration = Math.random() * 1 + 0.5; // 0.5s to 1.5s
  const delay = Math.random() * 0.5;
  const x = Math.random() * 100 - 50;
  const y = Math.random() * 100 - 50;
  
  return {
    width: `${size}px`,
    height: `${size}px`,
    top: `${50 + y/2}%`, // 중앙에서 퍼지도록
    left: `${50 + x/2}%`,
    'animation-duration': `${duration}s`,
    'animation-delay': `${delay}s`,
  };
};

onMounted(() => {
    // 캔버스 크기 조정 후 사다리 생성 및 그리기
    const resizeObserver = new ResizeObserver(() => {
        generateLadder(); // 크기 변경 시 사다리 재생성 및 그리기
    });
    if (ladderCanvas.value) {
        resizeObserver.observe(ladderCanvas.value);
    }
    window.addEventListener('resize', drawLadder); // 창 크기 변경 시에도 그리기
});

onUnmounted(() => {
    if (ladderCanvas.value) {
        const resizeObserver = new ResizeObserver(() => {}); // 더미 옵저버
        resizeObserver.unobserve(ladderCanvas.value);
    }
    window.removeEventListener('resize', drawLadder);
});
</script>

<style scoped>
.ladder-game-page { padding: 20px; background-color: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 70px); }
.card { background: white; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); }
.game-container { padding: 30px 40px; width: 100%; max-width: 600px; text-align: center; }
.game-header h1 { margin: 0 0 10px; font-size: 2em; display: flex; align-items: center; justify-content: center; gap: 10px; }
.game-header h1 i { color: #007bff; }
.game-header p { margin: 0 0 30px; color: #666; }

.ladder-wrapper { position: relative; height: 300px; margin-bottom: 30px; }
.ladder-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }

/* [핵심 수정] 시작/끝 점 위치 조정 */
.start-points, .end-points { 
  position: absolute; 
  left: 0; 
  right: 0; 
  display: flex; 
  justify-content: flex-start; /* flex-start로 변경하고 left 값으로 위치 조정 */
  padding: 0; /* 패딩 제거 */
  box-sizing: border-box;
  width: 100%;
}
.start-points { top: -20px; }
.end-points { bottom: -20px; }

.point {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; font-size: 1.2em;
  background: #e9ecef; border: 2px solid #adb5bd;
  transition: all 0.2s;
  position: absolute; /* absolute로 변경하여 left로 정확한 위치 지정 */
  transform: translateX(-50%); /* 자신의 너비의 절반만큼 왼쪽으로 이동하여 중앙 정렬 */
  z-index: 2;
}
.point.start { cursor: pointer; }
.point.start:hover { transform: translateX(-50%) scale(1.1); } /* 트랜스폼 유지 */
.point.start.active { border-color: #007bff; background: #007bff; color: white; }
.point.start.disabled { cursor: not-allowed; opacity: 0.7; }

.point.end { font-size: 0.9em; }
.point.end.win-high { background: #ffd700; border-color: #f1c40f; color: #333; }
.point.end.win-low { background: #d4edda; border-color: #c3e6cb; color: #155724; }
.point.end.lose { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }

/* [추가] 당첨/꽝 이펙트 스타일 */
.win-effect-container, .lose-effect {
    position: absolute;
    inset: 0; /* 부모 point에 꽉 채움 */
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden; /* 이펙트가 부모 밖으로 나가지 않도록 */
    z-index: 3; /* 숫자 위로 오도록 */
}

/* 색종이 이펙트 */
.confetti {
  position: absolute;
  background-color: var(--background-color);
  animation: confetti-fall var(--animation-duration) ease-out var(--animation-delay) forwards;
  opacity: 0;
  border-radius: 2px;
}

@keyframes confetti-fall {
  0% { transform: translate(var(--start-x), var(--start-y)) rotate(0deg); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translate(var(--end-x), var(--end-y)) rotate(720deg); opacity: 0; }
}

/* 반짝이 이펙트 */
.sparkle {
    position: absolute;
    background-color: white;
    border-radius: 50%;
    box-shadow: 0 0 5px 2px rgba(255, 255, 255, 0.7);
    animation: sparkle-fade var(--animation-duration) ease-out var(--animation-delay) forwards;
    opacity: 0;
}

@keyframes sparkle-fade {
    0% { transform: scale(0); opacity: 0; }
    50% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0); opacity: 0; }
}

/* 꽝 이펙트 */
.lose-effect i {
    font-size: 2.5em;
    color: #dc3545; /* 빨간색 X */
    animation: bounce-in 0.3s ease-out;
}

@keyframes bounce-in {
    0% { transform: scale(0); opacity: 0; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(1); }
}


.setup-controls, .results-display { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.cost-info { font-weight: bold; color: #333; font-size: 1.1em; }
.start-button { background-color: #28a745; color: white; padding: 12px 30px; border: none; border-radius: 8px; font-size: 1.1em; font-weight: bold; cursor: pointer; transition: background-color 0.2s; }
.start-button:disabled { background-color: #aaa; }
.summary { width: 100%; border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px; }
.summary p { margin: 5px 0; display: flex; justify-content: space-between; font-size: 1.1em; }
.win { color: #28a745; }
.lose { color: #dc3545; }
.error-message { color: #dc3545; margin-top: 20px; }
.spinner-small { border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>