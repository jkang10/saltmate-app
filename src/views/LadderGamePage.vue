<template>
  <div class="page-container ladder-game-page">
    <header class="page-header">
      <h1><i class="fas fa-stream"></i> 행운의 사다리타기</h1>
      <p>참가비 1,000 SaltMate를 내고 운명의 사다리를 타보세요!</p>
    </header>

    <div class="ladder-container">
      <div class="ladder-header">
        <div 
          v-for="(player, index) in players" 
          :key="player.id" 
          class="player-entry"
          :class="{ selected: selectedPlayerId === player.id }"
          :style="getPlayerEntryStyle(index)"
          @click="selectPlayer(player.id)"
        >
          {{ player.id }}
        </div>
      </div>
      <div class="ladder-body">
        <canvas ref="canvasRef" class="ladder-canvas"></canvas>
        <svg class="animation-svg" :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`">
          <path ref="pathRef" :d="pathData" class="animation-path" />
        </svg>
      </div>

      <div class="ladder-footer">
        <div v-if="gameResult" class="results-container">
           <div 
            v-for="(result, index) in results" 
            :key="index" 
            class="result-entry"
            :class="{ revealed: result.revealed, 'is-win': gameResult.resultIndex === index }"
          >
            <span v-if="result.revealed" class="result-text">{{ result.value.toLocaleString() }}</span>
            <span v-else>?</span>
          </div>
        </div>
        
        <div v-else class="start-button-container">
          <button @click="playLadder" :disabled="!selectedPlayerId || isAnimating">
            <i class="fas fa-play"></i> 참여하기
          </button>
        </div>
        </div>

      <div class="action-buttons">
        <button v-if="gameResult && !isAnimating" @click="resetGame" class="btn-reset">
          <i class="fas fa-sync-alt"></i> 다시하기
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const playerCount = ref(5);
const players = ref([]);
const results = ref([]);
const ladders = ref([]);
const selectedPlayerId = ref(null);
const gameResult = ref(null);
const canvasRef = ref(null);
const pathRef = ref(null);

const isAnimating = ref(false);
const animationPath = ref([]);
const pathData = ref('');
const canvasWidth = ref(0);
const canvasHeight = ref(0);

const ENTRY_WIDTH = 80;
const LADDER_HEIGHT = 400;

// ==================== [핵심 추가] 숫자 박스 위치 계산 함수 ====================
const getPlayerEntryStyle = (index) => {
  const x = index * ENTRY_WIDTH + ENTRY_WIDTH / 2;
  return {
    position: 'absolute',
    left: `${x}px`,
    transform: 'translateX(-50%)'
  };
};
// ==========================================================================

const generateGame = () => {
  players.value = Array.from({ length: playerCount.value }, (_, i) => ({ id: i + 1, selected: false }));
  
  const possibleResults = [100, 500, 1000, 2000, 5000];
  let tempResults = [...possibleResults];
  results.value = [];
  while(tempResults.length > 0) {
    const randomIndex = Math.floor(Math.random() * tempResults.length);
    results.value.push({ value: tempResults.splice(randomIndex, 1)[0], revealed: false });
  }

  const rows = 10;
  ladders.value = Array.from({ length: rows }, () => Array(playerCount.value - 1).fill(false));
  for (let i = 0; i < rows; i++) {
    const pos = Math.floor(Math.random() * (playerCount.value - 1));
    ladders.value[i][pos] = true;
    if (pos > 0) ladders.value[i][pos-1] = false;
    if (pos < playerCount.value - 2) ladders.value[i][pos+1] = false;
  }
};

const drawLadder = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  canvas.width = playerCount.value * ENTRY_WIDTH;
  canvas.height = LADDER_HEIGHT;
  canvasWidth.value = canvas.width;
  canvasHeight.value = canvas.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;

  const rowHeight = LADDER_HEIGHT / (ladders.value.length + 1);

  for (let i = 0; i < playerCount.value; i++) {
    const x = i * ENTRY_WIDTH + ENTRY_WIDTH / 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LADDER_HEIGHT);
    ctx.stroke();
  }

  ladders.value.forEach((row, i) => {
    row.forEach((hasRung, j) => {
      if (hasRung) {
        const y = (i + 1) * rowHeight;
        const x1 = j * ENTRY_WIDTH + ENTRY_WIDTH / 2;
        const x2 = (j + 1) * ENTRY_WIDTH + ENTRY_WIDTH / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();
      }
    });
  });
};

const selectPlayer = (id) => {
  if (gameResult.value || isAnimating.value) return;
  selectedPlayerId.value = id;
};

const playLadder = async () => {
  if (!selectedPlayerId.value || isAnimating.value) return;
  
  try {
    const playLadderGame = httpsCallable(functions, 'playLadderGame');
    const response = await playLadderGame();
    if(response.data.error) throw new Error(response.data.error);
  } catch(e) {
    alert(`오류: ${e.message}`);
    return;
  }

  isAnimating.value = true;
  const selectedIndex = selectedPlayerId.value - 1;
  const rowHeight = LADDER_HEIGHT / (ladders.value.length + 1);
  let currentPosition = selectedIndex;
  
  const pathPoints = [];
  const startX = selectedIndex * ENTRY_WIDTH + ENTRY_WIDTH / 2;
  pathPoints.push([startX, -10]); // 위에서부터 시작하는 느낌을 주기 위해 y 시작점을 -10으로 조정
  pathPoints.push([startX, 0]);

  for (let i = 0; i < ladders.value.length; i++) {
    const y = (i + 1) * rowHeight;
    const currentX = currentPosition * ENTRY_WIDTH + ENTRY_WIDTH / 2;
    pathPoints.push([currentX, y]);

    if (currentPosition > 0 && ladders.value[i][currentPosition - 1]) {
      currentPosition--;
    } else if (currentPosition < playerCount.value - 1 && ladders.value[i][currentPosition]) {
      currentPosition++;
    }
    const nextX = currentPosition * ENTRY_WIDTH + ENTRY_WIDTH / 2;
    pathPoints.push([nextX, y]);
  }
  const endX = currentPosition * ENTRY_WIDTH + ENTRY_WIDTH / 2;
  pathPoints.push([endX, LADDER_HEIGHT]);
  pathPoints.push([endX, LADDER_HEIGHT + 10]); // 아래로 살짝 벗어나도록 조정

  pathData.value = pathPoints.map((p, i) => (i === 0 ? 'M' : 'L') + `${p[0]},${p[1]}`).join(' ');

  const finalResultIndex = currentPosition;
  gameResult.value = { 
    startId: selectedPlayerId.value,
    resultIndex: finalResultIndex,
    value: results.value[finalResultIndex].value
  };

  await nextTick();

  const pathElement = pathRef.value;
  if (pathElement) {
    const length = pathElement.getTotalLength();
    pathElement.style.strokeDasharray = length;
    pathElement.style.strokeDashoffset = length;
    // 강제 리플로우 후 애니메이션 클래스 추가
    pathElement.getBoundingClientRect();
    pathElement.classList.add('animate');
  }

  const animationDuration = 2000;
  setTimeout(() => {
    results.value[finalResultIndex].revealed = true;
    isAnimating.value = false;
  }, animationDuration);
};

const resetGame = () => {
  selectedPlayerId.value = null;
  gameResult.value = null;
  pathData.value = '';
  const pathElement = pathRef.value;
  if(pathElement) {
    pathElement.classList.remove('animate');
    // 스타일을 직접 초기화하여 다음 애니메이션이 정상 동작하도록 보장
    pathElement.style.strokeDasharray = 'none';
    pathElement.style.strokeDashoffset = 'none';
  }
  generateGame();
  drawLadder();
};

onMounted(() => {
  generateGame();
  drawLadder();
});
</script>

<style scoped>
/* 이전과 거의 동일, ladder-header 와 start-button-container 부분만 수정 */
.ladder-game-page { text-align: center; }
.ladder-container { background: #34495e; padding: 20px; border-radius: 15px; max-width: 500px; margin: auto; }

/* ==================== [핵심 수정] 숫자 박스 컨테이너 스타일 변경 ==================== */
.ladder-header {
  position: relative;
  height: 40px; /* 고정 높이 부여 */
  width: calc(5 * 80px); /* canvas 너비와 동일하게 설정 */
  margin: 0 auto;
}
.results-container { display: flex; justify-content: space-around; width: calc(5 * 80px); margin: 0 auto; }
/* =============================================================================== */

.player-entry, .result-entry { width: 60px; height: 40px; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 1.2em; }
.player-entry { cursor: pointer; border-radius: 8px; transition: all 0.2s; }
.player-entry:hover { background: #4a627c; }
.player-entry.selected { background: #2980b9; color: white; transform: translateX(-50%) scale(1.1); } /* transform 수정 */
.ladder-body { position: relative; margin: 10px 0; }
.ladder-canvas { display: block; }

/* ==================== [핵심 수정] 버튼 컨테이너 스타일 되돌리기 ==================== */
.ladder-footer { position: relative; height: 60px; display: flex; justify-content: center; align-items: center; }
.start-button-container button {
  padding: 10px 25px;
  font-size: 1.1em;
  font-weight: bold;
  background: #f1c40f;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  color: #333;
}
/* =============================================================================== */

.start-button-container button:disabled { background: #7f8c8d; cursor: not-allowed; }
.result-entry { background: #4a627c; border-radius: 8px; color: #fff; }
.result-entry.revealed { background: #2ecc71; animation: reveal-effect 0.5s ease-out; }
.result-entry.revealed.is-win { box-shadow: 0 0 20px #2ecc71; }
.action-buttons { margin-top: 20px; }
.btn-reset { padding: 12px 30px; background: #e74c3c; border-radius: 8px; border:none; color:white; font-weight: bold; cursor: pointer;}

.animation-svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.animation-path {
  stroke: #f1c40f;
  stroke-width: 5;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.animation-path.animate {
  transition: stroke-dashoffset 2s ease-in-out;
  stroke-dashoffset: 0 !important;
}
@keyframes reveal-effect {
  0% { transform: scale(0.5); opacity: 0; }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
</style>