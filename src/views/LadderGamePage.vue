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
               :style="{ left: `${getLegX(n - 1)}px` }">
            {{ n }}
          </div>
        </div>
        <div class="end-points">
          <div v-for="(result, index) in results" :key="index" 
               class="point end"
               :style="{ left: `${getLegX(index)}px` }">
            
            <transition name="result-pop">
              <div v-if="gameEnded && finalResultIndex === index" 
                   class="result-content"
                   :class="getResultClass(result.prize)">
                <span>{{ result.prize > 0 ? `+${result.prize.toLocaleString()}` : '꽝' }}</span>
              </div>
            </transition>

            <span v-if="!gameStarted && !(gameEnded && finalResultIndex === index)">?</span>
            
            <div v-if="gameEnded && finalResultIndex === index && result.prize > 0" class="win-effect-container">
                <div class="confetti" v-for="i in 20" :key="'confetti-'+i" :style="getConfettiStyle()"></div>
                <div class="sparkle" v-for="i in 10" :key="'sparkle-'+i"></div>
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { httpsCallable, getFunctions } from 'firebase/functions';

// --- 반응형 상태 변수 ---
const isLoading = ref(false); // 서버 통신 중 로딩 상태
const gameStarted = ref(false); // 게임 시작 여부
const gameEnded = ref(false); // 게임 종료 여부 (결과 공개 상태)
const results = ref([]); // 서버에서 받은 모든 사다리 도착 결과
const error = ref(null); // 에러 메시지
const selectedEntry = ref(null); // 사용자가 선택한 시작점 (1부터 NUM_LEGS)
const ladderCanvas = ref(null); // 캔버스 DOM 요소 참조
const finalResultIndex = ref(null); // 사용자가 선택한 사다리의 최종 도착점 인덱스 (0부터 NUM_LEGS-1)

// --- 일반 변수 ---
let ladder = []; // 사다리 가로선 데이터 [{from: 시작세로줄_index, y: Y_좌표}]
let ctx = null; // 캔버스 2D 렌더링 컨텍스트
const NUM_LEGS = 5; // 사다리 세로줄(다리) 개수
const LADDER_PADDING_X = 20; // 캔버스 좌우 가장자리에서 사다리 시작/끝까지의 패딩

// --- 계산된 속성 (Computed Properties) ---
// 총 획득 금액 계산
const totalWinnings = computed(() => {
    if (!gameEnded.value || finalResultIndex.value === null) return 0;
    const finalResult = results.value[finalResultIndex.value];
    return finalResult ? finalResult.prize : 0;
});

// 최종 손익 계산 (총 획득 - 참가비)
const netGain = computed(() => totalWinnings.value - 100);

// --- 함수 ---

// [수정] 사다리 세로줄의 X 좌표 계산 (캔버스 너비와 패딩을 고려하여 중앙 정렬)
const getLegX = (index) => {
    if (!ladderCanvas.value) return 0;
    const width = ladderCanvas.value.getBoundingClientRect().width;
    // (전체 캔버스 너비 - 좌우 패딩)을 다리 개수-1 로 나누어 간격 계산
    const legSpacing = (width - LADDER_PADDING_X * 2) / (NUM_LEGS - 1);
    // 패딩 + (인덱스 * 간격)
    return LADDER_PADDING_X + index * legSpacing;
};

// 시작점 선택 핸들러
const selectStart = (n) => {
  if (gameStarted.value) return; // 게임 시작 후에는 선택 불가
  selectedEntry.value = n;
};

// 캔버스에 사다리 그리기
const drawLadder = () => {
    if (!ladderCanvas.value) return;
    const canvas = ladderCanvas.value;
    ctx = canvas.getContext('2d');
    
    // 고해상도 디스플레이 (Retina 등) 지원
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 초기화
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ced4da'; // 기본 사다리 색상

    // 세로선 그리기
    for (let i = 0; i < NUM_LEGS; i++) {
        ctx.beginPath();
        ctx.moveTo(getLegX(i), 20); // 상단 여백 20px
        ctx.lineTo(getLegX(i), rect.height - 20); // 하단 여백 20px
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
    const ySpacing = (height - 120) / numCrosses; // 가로선 Y축 간격 (위아래 여백 제외)
    let lastLeg = -2; // 이전에 가로선이 연결된 다리 번호 (연속으로 같은 다리에 연결되지 않게)

    for (let i = 0; i < numCrosses; i++) {
        let from;
        do {
            from = Math.floor(Math.random() * (NUM_LEGS - 1)); // 0부터 NUM_LEGS-2 다리 사이
        } while (from === lastLeg); // 인접한 다리에 가로선이 연속으로 생기지 않도록 방지
        const y = 60 + i * ySpacing + (Math.random() - 0.5) * 10; // Y축 위치 + 약간의 무작위성으로 자연스럽게
        ladder.push({ from, y });
        lastLeg = from;
    }
    drawLadder(); // 가로선 생성 후 바로 캔버스에 그리기
};

// 특정 시작점에서 사다리 타고 내려가서 최종 도착점 인덱스 계산
const traceLeg = (startLeg) => {
    let currentLeg = startLeg;
    const sortedCrosses = [...ladder].sort((a,b) => a.y - b.y); // Y축 기준으로 정렬하여 위에서 아래로 탐색
    for (const cross of sortedCrosses) {
        if (cross.from === currentLeg) currentLeg++; // 현재 다리에서 오른쪽으로 가로선이 연결되면 오른쪽 다리로 이동
        else if (cross.from + 1 === currentLeg) currentLeg--; // 현재 다리에서 왼쪽으로 가로선이 연결되면 왼쪽 다리로 이동
    }
    return currentLeg; // 최종 도착점 인덱스 (0부터 NUM_LEGS-1)
};

// [수정] 선택된 사다리 라인만 애니메이션으로 그리기 (재귀적 Promise 기반)
const animateTrace = async (startLegIndex) => {
    if (!ctx) return;
    
    // 애니메이션 라인 스타일 설정
    ctx.strokeStyle = '#007bff'; // 파란색 라인
    ctx.lineWidth = 6;
    ctx.lineCap = 'round'; // 둥근 끝선

    let currentLeg = startLegIndex;
    let currentY = 20; // 시작 Y 좌표 (캔버스 상단 여백)
    const sortedCrosses = [...ladder].sort((a,b) => a.y - b.y); // Y축 기준으로 정렬하여 위에서 아래로 탐색

    for (const cross of sortedCrosses) {
        // 현재 Y에서 다음 가로선 Y까지 세로로 이동 (세로선 그리기)
        if(cross.y > currentY) {
            await drawLineSegment(getLegX(currentLeg), currentY, getLegX(currentLeg), cross.y);
            currentY = cross.y;
        }

        // 가로선이 현재 다리에 연결되어 있으면 가로로 이동 (가로선 그리기)
        if (cross.from === currentLeg) { // 현재 다리에서 오른쪽으로 연결된 경우
            await drawLineSegment(getLegX(currentLeg), currentY, getLegX(currentLeg + 1), currentY);
            currentLeg++; // 오른쪽 다리로 이동
        } else if (cross.from + 1 === currentLeg) { // 현재 다리에서 왼쪽으로 연결된 경우
            await drawLineSegment(getLegX(currentLeg), currentY, getLegX(currentLeg - 1), currentY);
            currentLeg--; // 왼쪽 다리로 이동
        }
    }
    // 마지막 가로선부터 바닥까지 세로로 이동
    const height = ladderCanvas.value.getBoundingClientRect().height;
    await drawLineSegment(getLegX(currentLeg), currentY, getLegX(currentLeg), height - 20);

    // [핵심] 애니메이션 완료 후 최종 결과 공개 및 게임 종료 처리
    finalResultIndex.value = currentLeg; // 최종 도착 다리 인덱스 기록
    setTimeout(() => { gameEnded.value = true; }, 500); // 짧은 딜레이 후 게임 종료 상태로 전환
};

// [수정] 선분 그리기 애니메이션 함수 (각 프레임마다 캔버스 리드로잉)
const drawLineSegment = (x1, y1, x2, y2) => {
    return new Promise(resolve => {
        const duration = 150; // 각 선분 그리는 시간 (짧게 설정하여 빠르게 진행)
        const startTime = performance.now();
        const dpr = window.devicePixelRatio || 1; // 캔버스 스케일링 고려

        const animate = (time) => {
            const elapsed = time - startTime;
            let progress = elapsed / duration;
            if (progress > 1) progress = 1; // 100% 이상 진행되지 않도록

            // 캔버스 전체를 지우고 기본 사다리를 다시 그림 (이것이 중요!)
            ctx.clearRect(0, 0, ctx.canvas.width / dpr, ctx.canvas.height / dpr);
            drawLadder(); 

            // 애니메이션 라인 그리기
            ctx.strokeStyle = '#007bff';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';

            const currentX = x1 + (x2 - x1) * progress;
            const currentY = y1 + (y2 - y1) * progress;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();

            if (progress < 1) requestAnimationFrame(animate); // 애니메이션 계속 진행
            else resolve(); // 애니메이션 완료 시 Promise resolve
        };
        requestAnimationFrame(animate);
    });
};


// 게임 시작 핸들러
const startGame = async () => {
  isLoading.value = true; // 로딩 상태 활성화
  error.value = null; // 에러 메시지 초기화
  gameStarted.value = true; // 게임 시작 상태로 변경 (점 선택 비활성화)
  gameEnded.value = false; // 혹시 모를 재시작 시 게임 종료 상태 초기화
  finalResultIndex.value = null; // 최종 결과 인덱스 초기화

  try {
    const functionsWithRegion = getFunctions(undefined, "asia-northeast3"); // Firebase Functions 인스턴스 가져오기
    const playLadderGame = httpsCallable(functionsWithRegion, 'playLadderGame'); // 호출 가능한 함수 참조
    
    // 서버에서 NUM_LEGS 개의 모든 다리에 대한 결과 받기
    const response = await playLadderGame({ entryCount: NUM_LEGS }); 
    results.value = response.data.results; // 서버로부터 받은 모든 결과 저장

    // [핵심] 사용자가 선택한 다리(startLegIndex)를 따라 애니메이션 시작
    await animateTrace(selectedEntry.value - 1); 

  } catch (err) {
    console.error("사다리타기 게임 오류:", err);
    error.value = err.message || "게임 플레이 중 오류가 발생했습니다.";
    gameStarted.value = false; // 오류 발생 시 게임 시작 상태 초기화
  } finally {
    isLoading.value = false; // 로딩 상태 비활성화
  }
};

// 게임 초기화 (다시하기)
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

// 결과에 따른 CSS 클래스 반환 (최종 결과만 적용)
const getResultClass = (prize) => {
    if (!gameEnded.value || finalResultIndex.value === null) return ''; // 게임 종료 전/결과 없을 땐 클래스 없음
    if (prize > 100) return 'win-high'; // 높은 당첨
    if (prize > 0) return 'win-low'; // 낮은 당첨
    return 'lose'; // 꽝
};

// [추가] 당첨 이펙트 - 색종이 스타일 동적 생성
const getConfettiStyle = () => {
  const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#4caf50', '#ffeb3b', '#ff9800'];
  return {
    '--color': colors[Math.floor(Math.random() * colors.length)],
    '--x-start': `${Math.random() * 200 - 100}px`, // -100px ~ 100px
    '--y-start': `${Math.random() * 200 - 100}px`, // -100px ~ 100px
    '--x-end': `${Math.random() * 400 - 200}px`, // -200px ~ 200px
    '--y-end': `${Math.random() * 100 + 100}px`, // 100px ~ 200px (아래로 떨어지는 효과)
    'animation-duration': `${Math.random() * 1 + 1.5}s`, // 1.5s ~ 2.5s
    'animation-delay': `${Math.random() * 0.5}s`, // 0s ~ 0.5s
  };
};

// --- 라이프사이클 훅 ---
onMounted(() => {
    // 캔버스 크기 변경 감지 및 사다리 재생성/그리기
    const resizeObserver = new ResizeObserver(() => {
        generateLadder(); // 크기 변경 시 사다리 재생성 및 그리기
    });
    if (ladderCanvas.value) {
        resizeObserver.observe(ladderCanvas.value);
    }
    // 초기 로드 시 사다리 생성
    generateLadder(); 
    window.addEventListener('resize', drawLadder); // 창 크기 변경 시에도 그리기
});

onUnmounted(() => {
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    if (ladderCanvas.value) {
        const resizeObserver = new ResizeObserver(() => {}); // 더미 옵저버
        resizeObserver.unobserve(ladderCanvas.value);
    }
    window.removeEventListener('resize', drawLadder);
});
</script>

<style scoped>
/* --- 페이지 전체 레이아웃 및 카드 스타일 --- */
.ladder-game-page {
  padding: 20px;
  background-color: #f0f2f5; /* 밝은 회색 배경 */
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 70px); /* 헤더 제외한 높이 */
}

.card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.1); /* 그림자 효과 */
}

.game-container {
  padding: 30px 40px;
  width: 100%;
  max-width: 600px; /* 최대 너비 제한 */
  text-align: center;
}

.game-header h1 {
  margin: 0 0 10px;
  font-size: 2em;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px; /* 아이콘과 텍스트 간격 */
  color: #333;
}

.game-header h1 i {
  color: #007bff; /* 아이콘 색상 */
}

.game-header p {
  margin: 0 0 30px;
  color: #666;
}

/* --- 사다리 영역 --- */
.ladder-wrapper {
  position: relative;
  height: 300px; /* 사다리 영역 높이 */
  margin-bottom: 30px;
}

.ladder-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1; /* 캔버스가 가장 아래에 위치 */
}

/* 시작점/끝점 컨테이너 */
.start-points, .end-points { 
  position: absolute; 
  left: 0; 
  width: 100%; 
  display: flex; 
  justify-content: flex-start; /* left 속성으로 위치를 직접 지정하므로 flex-start */
}
.start-points { top: -20px; } /* 캔버스 위로 약간 띄움 */
.end-points { bottom: -20px; } /* 캔버스 아래로 약간 띄움 */

/* 각 시작점/끝점 원형 버튼 */
.point {
  width: 40px; height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 1.2em;
  background: #e9ecef;
  border: 2px solid #adb5bd;
  transition: all 0.2s;
  position: absolute; /* left 값으로 위치 지정 */
  transform: translateX(-50%); /* 자신의 너비의 절반만큼 왼쪽으로 이동하여 중앙 정렬 */
  z-index: 2; /* 캔버스 위에 위치 */
}

.point.start { cursor: pointer; }
.point.start:hover { transform: translateX(-50%) scale(1.1); }
.point.start.active {
  border-color: #007bff;
  background: #007bff;
  color: white;
}
.point.start.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.point.end { 
  font-size: 1em; 
  overflow: visible; /* 이펙트가 원형 밖으로 나갈 수 있도록 */
  background: transparent; /* 결과가 직접 원 안에 표시되지 않으므로 배경 투명하게 */
  border: none; /* 테두리 제거 */
}

/* --- 결과 내용 표시 스타일 --- */
.result-content {
    background: white;
    padding: 5px 10px;
    border-radius: 8px;
    font-weight: bold;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    position: absolute; /* 최종 도착점 위에 위치 */
    top: 50%; left: 50%;
    transform: translate(-50%, -50%); /* 정확히 중앙 정렬 */
    min-width: 60px; /* 최소 너비 */
    text-align: center;
    white-space: nowrap; /* 줄바꿈 방지 */
}
.result-content.win-high { background: #ffd700; color: #333; } /* 황금색 */
.result-content.win-low { background: #d4edda; color: #155724; } /* 연한 녹색 */
.result-content.lose { background: #f8d7da; color: #721c24; } /* 연한 빨간색 */

/* 결과 팝업 애니메이션 */
.result-pop-enter-active {
  animation: result-pop-in 0.5s 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}
@keyframes result-pop-in {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

/* --- 당첨/꽝 이펙트 --- */
.win-effect-container {
    position: absolute;
    top: 50%; left: 50%;
    width: 200px; height: 200px;
    transform: translate(-50%, -50%);
    pointer-events: none; /* 마우스 이벤트 무시 */
    overflow: hidden; /* 이펙트가 컨테이너 밖으로 나가지 않도록 */
}

/* 색종이 이펙트 */
.confetti {
  position: absolute;
  width: 8px; height: 8px;
  background: var(--color);
  opacity: 0;
  animation: confetti-fall var(--animation-duration) ease-out forwards;
  border-radius: 2px;
}
@keyframes confetti-fall {
  0% { transform: translate(var(--x-start), var(--y-start)) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--x-end), var(--y-end)) rotate(720deg); opacity: 0; }
}

/* 반짝이 이펙트 */
.sparkle {
    position: absolute; top: 50%; left: 50%;
    width: 6px; height: 6px;
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 0 10px 4px #fff, 0 0 20px 8px #f0f, 0 0 30px 12px #0ff; /* 빛나는 효과 */
    animation: sparkle-burst 0.8s ease-out forwards;
}
@keyframes sparkle-burst {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.5); } /* 크게 터졌다가 */
  100% { transform: translate(-50%, -50%) scale(0); opacity: 0; } /* 사라짐 */
}

/* 꽝 이펙트 */
.lose-effect {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2.5em;
  color: #dc3545; /* 빨간색 X */
  animation: bounce-in 0.3s ease-out; /* 튀어 오르는 애니메이션 */
}
@keyframes bounce-in {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    50% { transform: translate(-50%, -50%) scale(1.2); }
    100% { transform: translate(-50%, -50%) scale(1); }
}

/* --- 게임 컨트롤 및 결과 요약 --- */
.setup-controls, .results-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.results-display {
    margin-top: 50px; /* [수정] 결과 표시 영역을 아래로 이동 */
}

.cost-info {
  font-weight: bold;
  color: #333;
  font-size: 1.1em;
}

.start-button {
  background-color: #28a745; /* 녹색 버튼 */
  color: white;
  padding: 12px 30px;
  border: none;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}
.start-button:hover:not(:disabled) {
  background-color: #218838;
}
.start-button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

.summary {
  width: 100%;
  border-top: 1px solid #eee;
  margin-top: 20px;
  padding-top: 20px;
}
.summary p {
  margin: 5px 0;
  display: flex;
  justify-content: space-between;
  font-size: 1.1em;
}

.win { color: #28a745; } /* 승리 텍스트 색상 */
.lose { color: #dc3545; } /* 패배 텍스트 색상 */

.error-message {
  color: #dc3545;
  margin-top: 20px;
}

/* 로딩 스피너 */
.spinner-small {
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>