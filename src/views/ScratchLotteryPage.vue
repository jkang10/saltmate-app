<template>
  <div class="lottery-page">
    <header class="game-header">
      <h2><i class="fas fa-ticket-alt"></i> 매일매일 행운 복권</h2>
      <p>은색 부분을 긁어 같은 그림 3개가 나오면 당첨!</p>
    </header>

    <div class="lottery-card-container">
      <div class="scratch-card" ref="cardRef">
        
        <div class="grid-layer">
          <div v-for="(icon, index) in resultIcons" :key="index" class="grid-item">
            <img :src="getIconSrc(icon)" :alt="`Icon ${icon}`" class="icon-img" />
          </div>
        </div>

        <canvas 
          ref="canvasRef"
          class="scratch-canvas"
          @mousedown="startScratch"
          @mousemove="scratch"
          @mouseup="stopScratch"
          @mouseleave="stopScratch"
          @touchstart.prevent="startScratch"
          @touchmove.prevent="scratch"
          @touchend.prevent="stopScratch"
        ></canvas>

        <div v-if="!isPlaying && !gameResult" class="overlay-msg">
          <button @click="buyTicket" class="btn-buy" :disabled="isLoading">
            <span v-if="isLoading">구매 중...</span>
            <span v-else>복권 구매하기 (100 P)</span>
          </button>
        </div>
        
        <div v-if="gameResult" class="result-overlay" :class="{ 'win': gameResult.prizeAmount > 0 }">
          <h3>{{ resultMessage }}</h3>
          <p v-if="gameResult.prizeAmount > 0" class="prize-amount">+{{ gameResult.prizeAmount.toLocaleString() }} SaltMate</p>
          <button @click="resetGame" class="btn-retry">다시 하기</button>
        </div>
      </div>
    </div>
    
    <div class="rules-card">
      <h4><i class="fas fa-info-circle"></i> 게임 규칙</h4>
      <ul>
        <li>1회 구매 비용: <strong>100 SaltMate</strong></li>
        <li>하루 최대 <strong>5회</strong>까지 참여 가능합니다.</li>
        <li>같은 그림이 <strong>3개</strong> 나오면 해당 금액 당첨!</li>
        <li><strong>1등:</strong> 5,000 P / <strong>2등:</strong> 1,000 P / <strong>3등:</strong> 500 P</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebaseConfig';

// 아이콘 이미지 (기존 gems 이미지 재활용)
import iconLoss from '@/assets/gems/gem_1.png'; // 꽝 (보라)
import iconSmall from '@/assets/gems/gem_2.png'; // 500 (파랑)
import iconMedium from '@/assets/gems/gem_4.png'; // 1000 (초록)
import iconBig from '@/assets/gems/gem_6.png'; // 5000 (빨강/노랑)

const canvasRef = ref(null);
const cardRef = ref(null);
const isDrawing = ref(false);
const isLoading = ref(false);
const isPlaying = ref(false);
const gameResult = ref(null); // { prizeAmount, resultType, icons }
const resultIcons = ref([0,0,0,0,0,0]); // 초기값
const scratchedPercent = ref(0);

const getIconSrc = (id) => {
  switch(id) {
    case 1: return iconSmall;
    case 2: return iconMedium;
    case 3: return iconBig;
    default: return iconLoss;
  }
};

const resultMessage = computed(() => {
  if (!gameResult.value) return '';
  if (gameResult.value.prizeAmount > 0) return '🎉 축하합니다! 당첨! 🎉';
  return '아쉽네요... 다음 기회에!';
});

// Canvas 초기화 (은색 덮기)
const initCanvas = () => {
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  const width = cardRef.value.clientWidth;
  const height = cardRef.value.clientHeight;
  
  // 레티나 디스플레이 대응
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  
  // CSS 사이즈 설정
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // 은색 코팅
  ctx.fillStyle = '#C0C0C0'; // 은색
  ctx.fillRect(0, 0, width, height);
  
  // 텍스트 ("긁어보세요!")
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('여기를 긁어보세요!', width / 2, height / 2);
  
  // 합성 모드 설정 (지우개 효과)
  ctx.globalCompositeOperation = 'destination-out';
};

// 복권 구매 함수
const buyTicket = async () => {
  if (!confirm("100 SaltMate를 사용하여 복권을 구매하시겠습니까?")) return;
  
  isLoading.value = true;
  try {
    const playFunc = httpsCallable(functions, 'playScratchLottery');
    const result = await playFunc();
    
    gameResult.value = result.data;
    resultIcons.value = result.data.icons;
    
    isPlaying.value = true;
    initCanvas(); // 구매 성공 시 캔버스 리셋 (덮기)
    
  } catch (error) {
    console.error("복권 구매 실패:", error);
    alert(error.message);
  } finally {
    isLoading.value = false;
  }
};

// 스크래치 이벤트 핸들러
const getPos = (e) => {
  const rect = canvasRef.value.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
};

const startScratch = (e) => {
  if (!isPlaying.value) return;
  isDrawing.value = true;
  scratch(e);
};

const scratch = (e) => {
  if (!isDrawing.value || !isPlaying.value) return;
  const pos = getPos(e);
  const ctx = canvasRef.value.getContext('2d');
  
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2); // 브러쉬 크기 25px
  ctx.fill();
  
  checkScratchPercent();
};

const stopScratch = () => {
  isDrawing.value = false;
  checkScratchPercent();
};

// 긁은 비율 계산
const checkScratchPercent = () => {
  if (!isPlaying.value) return; // 이미 결과가 나왔으면 중단

  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  // 성능을 위해 10% 간격으로 픽셀 샘플링 (전체 픽셀 검사는 너무 느림)
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  let transparentPixels = 0;
  const totalPixels = pixels.length / 4;
  
  // 32px 간격으로 샘플링 (속도 최적화)
  const step = 32; 
  let sampleCount = 0;
  let clearedCount = 0;

  for (let i = 0; i < totalPixels; i += step) {
    sampleCount++;
    if (pixels[i * 4 + 3] === 0) { // 투명도(Alpha)가 0이면 지워진 것
      clearedCount++;
    }
  }

  const percent = (clearedCount / sampleCount) * 100;
  
  // 50% 이상 긁으면 자동 공개
  if (percent > 50) {
    isPlaying.value = false; // 게임 종료 (결과 오버레이 표시)
    canvasRef.value.style.opacity = '0'; // 캔버스 숨김 (부드럽게)
  }
};

const resetGame = () => {
  gameResult.value = null;
  isPlaying.value = false;
  if (canvasRef.value) {
     canvasRef.value.style.opacity = '1';
     // 다음 게임을 위해 캔버스는 그대로 두거나, 미리보기용으로 초기화할 수 있음
     // 여기서는 '구매하기' 버튼이 뜨므로 캔버스는 뒤로 숨겨짐
  }
};

onMounted(async () => {
    await nextTick();
    // 초기 화면용 (더미)
    if(canvasRef.value) initCanvas();
});
</script>

<style scoped>
.lottery-page {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.game-header h2 {
  color: #E0A800;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
  margin-bottom: 5px;
}
.game-header p {
  color: #666;
  font-size: 0.95rem;
  margin-bottom: 30px;
}

/* 복권 카드 컨테이너 */
.lottery-card-container {
  width: 100%;
  max-width: 350px;
  aspect-ratio: 3 / 2; /* 3:2 비율 (일반적인 복권 비율) */
  position: relative;
  border-radius: 15px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.15);
  overflow: hidden;
  background-color: #fff;
  border: 4px solid #E0A800;
  margin-bottom: 30px;
}

.scratch-card {
  width: 100%;
  height: 100%;
  position: relative;
}

/* 결과 아이콘 그리드 (맨 밑바닥) */
.grid-layer {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  padding: 10px;
  gap: 10px;
  box-sizing: border-box;
  background-color: #fefefe;
}
.grid-item {
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px dashed #ddd;
  border-radius: 8px;
}
.icon-img {
  width: 60%;
  height: auto;
  object-fit: contain;
}

/* 긁는 영역 (Canvas - 중간) */
.scratch-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10; /* 그리드 위에 */
  cursor: url('https://cdn-icons-png.flaticon.com/32/240/240847.png') 16 16, auto; /* 동전 커서 (선택) */
  touch-action: none; /* 모바일 스크롤 방지 */
  transition: opacity 0.5s ease;
}

/* 구매 버튼 오버레이 (맨 위) */
.overlay-msg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255,255,255,0.3); /* 은은하게 */
}

.btn-buy {
  padding: 15px 30px;
  font-size: 1.2rem;
  font-weight: bold;
  color: white;
  background: linear-gradient(135deg, #FFC107, #FF9800);
  border: none;
  border-radius: 50px;
  box-shadow: 0 4px 15px rgba(255, 152, 0, 0.4);
  cursor: pointer;
  transition: transform 0.2s;
}
.btn-buy:active { transform: scale(0.95); }
.btn-buy:disabled { background: #ccc; cursor: not-allowed; box-shadow: none; }

/* 결과 오버레이 (게임 종료 시 표시) */
.result-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 30;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  animation: fadeIn 0.5s;
}
.result-overlay.win {
  background: rgba(255, 243, 205, 0.95); /* 당첨 시 금색 배경 */
}
.result-overlay h3 {
  font-size: 1.8rem;
  margin-bottom: 10px;
  color: #333;
}
.prize-amount {
  font-size: 1.5rem;
  font-weight: bold;
  color: #E0A800;
  margin-bottom: 20px;
}
.btn-retry {
  padding: 10px 25px;
  border: 2px solid #333;
  background: transparent;
  border-radius: 25px;
  font-weight: bold;
  cursor: pointer;
}

.rules-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 10px;
  text-align: left;
  width: 100%;
  max-width: 350px;
  font-size: 0.9rem;
  color: #555;
}
.rules-card h4 { margin-top: 0; margin-bottom: 10px; color: #333; }
.rules-card ul { padding-left: 20px; margin: 0; }
.rules-card li { margin-bottom: 5px; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>