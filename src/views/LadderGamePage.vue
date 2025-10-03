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
          <div v-for="n in 5" :key="n" 
               class="point start" 
               :class="{active: selectedEntry === n, disabled: gameStarted}"
               @click="selectStart(n)">
            {{ n }}
          </div>
        </div>
        <div class="end-points">
          <div v-for="(result, index) in results" :key="index" 
               class="point end"
               :class="getResultClass(result.prize)">
            <span v-if="!gameStarted">?</span>
            <span v-else>{{ result.prize > 0 ? `+${result.prize.toLocaleString()}` : '꽝' }}</span>
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
          <p>총 획득: <span class="win">{{ totalWinnings.toLocaleString() }} SaltMate</span></p>
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
// import { functions } from '@/firebaseConfig'; // 이 줄을 삭제하거나 주석 처리합니다.
import { httpsCallable, getFunctions } from 'firebase/functions';

const isLoading = ref(false);
const gameStarted = ref(false);
const gameEnded = ref(false);
const results = ref([]);
const error = ref(null);
const selectedEntry = ref(null);
const ladderCanvas = ref(null);
let ladder = [];
let ctx = null;
const NUM_LEGS = 5;

const totalWinnings = computed(() => {
    if (!gameStarted.value || results.value.length === 0) return 0;
    const finalLeg = traceLeg(selectedEntry.value - 1);
    const finalResult = results.value[finalLeg];
    return finalResult ? finalResult.prize : 0;
});
const netGain = computed(() => totalWinnings.value - 100);

const selectStart = (n) => {
  if (gameStarted.value) return;
  selectedEntry.value = n;
};

const getLegX = (index) => {
    if (!ladderCanvas.value) return 0;
    const width = ladderCanvas.value.getBoundingClientRect().width;
    return (width / NUM_LEGS) * (index + 0.5);
};

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
    ctx.strokeStyle = '#ced4da';

    for (let i = 0; i < NUM_LEGS; i++) {
        ctx.beginPath();
        ctx.moveTo(getLegX(i), 20);
        ctx.lineTo(getLegX(i), rect.height - 20);
        ctx.stroke();
    }
    for (const cross of ladder) {
        ctx.beginPath();
        ctx.moveTo(getLegX(cross.from), cross.y);
        ctx.lineTo(getLegX(cross.from + 1), cross.y);
        ctx.stroke();
    }
};

const generateLadder = () => {
    ladder = [];
    const height = ladderCanvas.value ? ladderCanvas.value.getBoundingClientRect().height : 300;
    const numCrosses = 7;
    const ySpacing = (height - 120) / numCrosses;
    let lastLeg = -2;

    for (let i = 0; i < numCrosses; i++) {
        let from;
        do {
            from = Math.floor(Math.random() * (NUM_LEGS - 1));
        } while (from === lastLeg);
        const y = 60 + i * ySpacing + (Math.random() - 0.5) * 10;
        ladder.push({ from, y });
        lastLeg = from;
    }
    drawLadder();
};

const traceLeg = (startLeg) => {
    let currentLeg = startLeg;
    const sortedCrosses = [...ladder].sort((a,b) => a.y - b.y);
    for (const cross of sortedCrosses) {
        if (cross.from === currentLeg) currentLeg++;
        else if (cross.from + 1 === currentLeg) currentLeg--;
    }
    return currentLeg;
};

const animateTrace = async () => {
    if (!ctx) return;
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    let currentLeg = selectedEntry.value - 1;
    let currentY = 20;
    const sortedCrosses = [...ladder].sort((a,b) => a.y - b.y);

    for (const cross of sortedCrosses) {
        if(cross.y > currentY) {
            await drawLine(getLegX(currentLeg), currentY, getLegX(currentLeg), cross.y);
            currentY = cross.y;
        }
        if (cross.from === currentLeg) {
            await drawLine(getLegX(currentLeg), currentY, getLegX(currentLeg + 1), currentY);
            currentLeg++;
        } else if (cross.from + 1 === currentLeg) {
            await drawLine(getLegX(currentLeg), currentY, getLegX(currentLeg - 1), currentY);
            currentLeg--;
        }
    }
    const height = ladderCanvas.value.getBoundingClientRect().height;
    await drawLine(getLegX(currentLeg), currentY, getLegX(currentLeg), height - 20);
    setTimeout(() => { gameEnded.value = true; }, 500);
};

const drawLine = (x1, y1, x2, y2) => {
    return new Promise(resolve => {
        const duration = 150;
        const startTime = performance.now();
        const animate = (time) => {
            const elapsed = time - startTime;
            let progress = elapsed / duration;
            if (progress > 1) progress = 1;
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
  try {
    const functionsWithRegion = getFunctions(undefined, "asia-northeast3");
    const playLadderGame = httpsCallable(functionsWithRegion, 'playLadderGame');
    const response = await playLadderGame({ entryCount: 1 });
    
    // 서버 결과를 실제 사다리 위치에 맞게 재배치
    const finalPositions = Array(NUM_LEGS);
    for (let i = 0; i < NUM_LEGS; i++) finalPositions[traceLeg(i)] = i;
    
    const finalResults = Array(NUM_LEGS);
    const serverPrize = response.data.results[0].prize;
    const winningLeg = traceLeg(selectedEntry.value - 1);

    for(let i=0; i<NUM_LEGS; i++){
      if(i === winningLeg) finalResults[i] = { prize: serverPrize };
      else finalResults[i] = { prize: 0 }; // 나머지는 꽝으로 채움
    }
    results.value = finalResults;
    
    gameStarted.value = true;
    await animateTrace();

  } catch (err) {
    console.error("사다리타기 게임 오류:", err);
    error.value = err.message || "게임 플레이 중 오류가 발생했습니다.";
  } finally {
    isLoading.value = false;
  }
};

const resetGame = () => {
  gameStarted.value = false;
  gameEnded.value = false;
  results.value = [];
  error.value = null;
  selectedEntry.value = null;
  setTimeout(() => {
      generateLadder();
      drawLadder();
  }, 10);
};

const getResultClass = (prize) => {
    if (prize > 100) return 'win-high';
    if (prize > 0) return 'win-low';
    return 'lose';
};

onMounted(() => {
    setTimeout(() => {
      generateLadder();
      window.addEventListener('resize', drawLadder);
    }, 100);
});

onUnmounted(() => {
    window.removeEventListener('resize', drawLadder);
});
</script>

<style scoped>
/* [핵심 수정] 전체적인 디자인 개선 */
.ladder-game-page { padding: 20px; background-color: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: calc(100vh - 70px); }
.card { background: white; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); }
.game-container { padding: 30px 40px; width: 100%; max-width: 600px; text-align: center; }
.game-header h1 { margin: 0 0 10px; font-size: 2em; display: flex; align-items: center; justify-content: center; gap: 10px; }
.game-header h1 i { color: #007bff; }
.game-header p { margin: 0 0 30px; color: #666; }

.ladder-wrapper { position: relative; height: 300px; margin-bottom: 30px; }
.ladder-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.start-points, .end-points { position: absolute; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 12.5%; /* [수정] 위치 보정 */ box-sizing: border-box; }
.start-points { top: -20px; }
.end-points { bottom: -20px; }
.point {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; font-size: 1.2em;
  background: #e9ecef; border: 2px solid #adb5bd;
  transition: all 0.2s;
  position: relative; /* z-index 적용 위함 */
  z-index: 2;
}
.point.start { cursor: pointer; }
.point.start:hover { transform: scale(1.1); }
.point.start.active { border-color: #007bff; background: #007bff; color: white; }
.point.start.disabled { cursor: not-allowed; opacity: 0.7; }

.point.end { font-size: 0.9em; }
.point.end.win-high { background: #ffd700; border-color: #f1c40f; color: #333; animation: prize-pop 0.5s ease-out; }
.point.end.win-low { background: #d4edda; border-color: #c3e6cb; color: #155724; animation: prize-pop 0.5s ease-out; }
.point.end.lose { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }
@keyframes prize-pop { from { transform: scale(0.5); } to { transform: scale(1); } }

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