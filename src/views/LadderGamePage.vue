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
import { ref, computed, onMounted } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

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

const totalWinnings = computed(() => results.value.length > 0 ? results.value[0].prize : 0);
const netGain = computed(() => totalWinnings.value - 100);

const selectStart = (n) => {
  if (gameStarted.value) return;
  selectedEntry.value = n;
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
    ctx.strokeStyle = '#a9a9a9';

    // 세로줄 그리기
    for (let i = 0; i < NUM_LEGS; i++) {
        ctx.beginPath();
        ctx.moveTo(getLegX(i), 20);
        ctx.lineTo(getLegX(i), canvas.height / dpr - 20);
        ctx.stroke();
    }
    // 가로줄 그리기
    for (const cross of ladder) {
        ctx.beginPath();
        ctx.moveTo(getLegX(cross.from), cross.y);
        ctx.lineTo(getLegX(cross.from + 1), cross.y);
        ctx.stroke();
    }
};

const getLegX = (index) => {
    if (!ladderCanvas.value) return 0;
    const width = ladderCanvas.value.getBoundingClientRect().width;
    return (width / (NUM_LEGS + 1)) * (index + 1);
};

const generateLadder = () => {
    ladder = [];
    const height = ladderCanvas.value ? ladderCanvas.value.getBoundingClientRect().height : 300;
    const numCrosses = 7; // 가로줄 개수
    const availableY = Array.from({length: numCrosses}, (_, i) => 60 + i * ((height - 120) / numCrosses));
    
    for (let i = 0; i < numCrosses; i++) {
        const from = Math.floor(Math.random() * (NUM_LEGS - 1));
        const y = availableY.splice(Math.floor(Math.random() * availableY.length), 1)[0];
        ladder.push({ from, y });
    }
    drawLadder();
};

const traceLadder = async () => {
    if (!ctx) return;
    const finalPositions = [];
    for (let i=0; i<NUM_LEGS; i++) {
        let currentLeg = i;
        const sortedCrosses = [...ladder].sort((a,b) => a.y - b.y);
        for (const cross of sortedCrosses) {
            if (cross.from === currentLeg) currentLeg++;
            else if (cross.from + 1 === currentLeg) currentLeg--;
        }
        finalPositions[i] = currentLeg;
    }
    
    // 서버 결과와 사다리 결과 매칭
    const serverResultIndex = finalPositions[selectedEntry.value - 1];
    results.value[serverResultIndex] = { prize: totalWinnings.value };

    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 6;
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

    setTimeout(() => {
        gameEnded.value = true;
    }, 500);
};

const drawLine = (x1, y1, x2, y2) => {
    return new Promise(resolve => {
        const duration = 200;
        const startTime = performance.now();
        const animate = (time) => {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
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
  results.value = Array(NUM_LEGS).fill({ prize: 0 }); // 결과 배열 초기화
  try {
    const playLadderGame = httpsCallable(functions, 'playLadderGame');
    const response = await playLadderGame({ entryCount: 1 }); // 1회만 참여
    
    // 서버로부터 받은 단일 결과를 임시 저장
    const serverResult = response.data.results[0];
    results.value = [{ prize: serverResult.prize }]; // 실제 당첨금만 우선 저장
    
    gameStarted.value = true;
    
    // 애니메이션 시작
    await traceLadder();

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
    generateLadder();
    window.addEventListener('resize', drawLadder);
});
</script>

<style scoped>
.ladder-game-page { padding: 20px; background-color: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
.card { background: white; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); }
.game-container { padding: 30px; width: 100%; max-width: 600px; text-align: center; }
.game-header h1 { margin: 0 0 10px; font-size: 2em; }
.game-header p { margin: 0 0 30px; color: #666; }

.ladder-wrapper { position: relative; height: 300px; margin-bottom: 30px; }
.ladder-canvas { width: 100%; height: 100%; }
.start-points, .end-points { position: absolute; left: 0; right: 0; display: flex; justify-content: space-around; }
.start-points { top: -20px; }
.end-points { bottom: -20px; }
.point {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; font-size: 1.2em;
  background: #e9ecef; border: 2px solid #adb5bd;
  transition: all 0.2s;
}
.point.start { cursor: pointer; }
.point.start:hover { transform: scale(1.1); }
.point.start.active { border-color: #007bff; background: #007bff; color: white; }
.point.start.disabled { cursor: not-allowed; opacity: 0.7; }

.point.end { font-size: 0.9em; }
.point.end.win-high { background: #ffd700; border-color: #f1c40f; color: #333; }
.point.end.win-low { background: #d4edda; border-color: #c3e6cb; color: #155724; }
.point.end.lose { background: #f8d7da; border-color: #f5c6cb; color: #721c24; }

.setup-controls, .results-display { display: flex; flex-direction: column; align-items: center; gap: 20px; }
.cost-info { font-weight: bold; color: #333; }
.start-button { background-color: #28a745; color: white; padding: 12px 30px; border: none; border-radius: 8px; font-size: 1.1em; font-weight: bold; cursor: pointer; }
.start-button:disabled { background-color: #aaa; }
.summary { width: 100%; border-top: 1px solid #eee; margin-top: 20px; padding-top: 20px; }
.summary p { margin: 5px 0; display: flex; justify-content: space-between; font-size: 1.1em; }
.win { color: #28a745; }
.lose { color: #dc3545; }
.error-message { color: #dc3545; margin-top: 20px; }
.spinner-small { border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
