<template>
  <div class="page-container hidden-object-page">
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner-large"></div>
      <p>게임을 불러오는 중...</p>
    </div>

    <div v-if="level" class="game-content">
      <header class="page-header">
        <h1><i class="fas fa-search"></i> 숨은그림찾기</h1>
        <p>이미지 속에 숨겨진 <strong>황금 소금 결정, 희귀 미네랄, 고대 유물</strong> 3가지를 찾아보세요!</p>
      </header>

      <aside class="ui-panel card">
        <div class="panel-header timer-container">
          <h3><i class="fas fa-hourglass-half"></i> 남은 시간</h3>
          <span class="timer">{{ timer }}</span>
        </div>
        <div class="panel-subheader">
          <h4><i class="fas fa-list-ul"></i> 찾아야 할 물건</h4>
        </div>
        <ul class="object-list">
          <li v-for="obj in level.objectsToFind" :key="obj.id" :class="{ 'found': isFound(obj.id) }">
            <div class="checkbox">
              <i v-if="isFound(obj.id)" class="fas fa-check"></i>
            </div>
            <span>{{ obj.name }}</span>
          </li>
        </ul>
      </aside>

      <main class="image-area" ref="imageAreaRef" @click="handleImageClick" @touchstart.prevent="handleImageClick">
        <img :src="level.imageUrl" alt="숨은그림찾기 배경" @load="onImageLoad" />
        
        <div 
          v-for="found in foundObjects" 
          :key="found.id" 
          class="found-marker" 
          :style="getMarkerStyle(found.id)"
        >
          <div class="sparkle"></div>
        </div>

        <div 
          v-for="click in clickMarkers" 
          :key="click.id" 
          class="click-feedback-marker" 
          :style="{ left: click.x + 'px', top: click.y + 'px' }"
        ></div>
      </main>
    </div>
    
    <div v-if="gameResult.status" class="game-over-modal">
      <div class="modal-content">
        <h2>{{ gameResult.title }}</h2>
        <p>{{ gameResult.message }}</p>
        <router-link to="/dashboard" class="btn-primary">대시보드로 돌아가기</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { useRouter } from 'vue-router';
import hiddenObjectBg from '@/assets/game_assets/hidden_object_bg.jpg';

const isLoading = ref(true);
const level = ref(null);
const foundObjects = ref([]);
const timer = ref(60);
const imageAreaRef = ref(null);
const gameResult = reactive({ status: null, title: '', message: '' });
const imageDimensions = reactive({ naturalWidth: 0, naturalHeight: 0 });
const router = useRouter();
let timerInterval = null;

// [피드백 개선] 클릭 위치 피드백을 위한 상태 추가
const clickMarkers = ref([]);
let clickMarkerId = 0;

const assignImageUrl = (levelData) => {
    if (levelData) {
        levelData.imageUrl = hiddenObjectBg;
    }
    return levelData;
};

const isFound = (objectId) => {
    return foundObjects.value.some(f => f.id === objectId);
};

const getMarkerStyle = (objectId) => {
    if (!level.value || !imageAreaRef.value) return {};
    // [핵심 수정] 이제 level.objectsToFind에 coords가 포함되어 있으므로 정상 동작합니다.
    const objToFind = level.value.objectsToFind.find(o => o.id === objectId);
    if (!objToFind || !objToFind.coords) return {};

    const img = imageAreaRef.value.querySelector('img');
    if (!img) return {};

    const displayRect = img.getBoundingClientRect();
    if (imageDimensions.naturalWidth === 0) return {}; // 이미지가 로드되기 전 오류 방지
    const scale = displayRect.width / imageDimensions.naturalWidth;
    
    return {
        left: `${objToFind.coords.x * scale}px`,
        top: `${objToFind.coords.y * scale}px`,
        width: `${objToFind.coords.width * scale}px`,
        height: `${objToFind.coords.height * scale}px`,
    };
};

const onImageLoad = (event) => {
    imageDimensions.naturalWidth = event.target.naturalWidth;
    imageDimensions.naturalHeight = event.target.naturalHeight;
};

// [피드백 개선] 클릭 위치를 잠시 보여주는 함수
const showClickFeedback = (x, y) => {
  const id = clickMarkerId++;
  clickMarkers.value.push({ id, x, y });
  setTimeout(() => {
    clickMarkers.value = clickMarkers.value.filter(marker => marker.id !== id);
  }, 400); // 0.4초 후에 마커 사라짐
};

const handleImageClick = async (event) => {
    if (!imageAreaRef.value || gameResult.status) return;
    const img = imageAreaRef.value.querySelector('img');
    if (!img || imageDimensions.naturalWidth === 0) return;

    const rect = img.getBoundingClientRect();
    
    // 모바일 터치(touches)와 PC 클릭(clientX)을 모두 안정적으로 지원
    const clickX = event.touches ? event.touches[0].clientX : event.clientX;
    const clickY = event.touches ? event.touches[0].clientY : event.clientY;

    const displayClickX = clickX - rect.left;
    const displayClickY = clickY - rect.top;

    // [피드백 개선] 클릭한 위치에 시각적 피드백 표시
    showClickFeedback(displayClickX, displayClickY);

    const scale = imageDimensions.naturalWidth / rect.width;
    
    const clickCoords = {
        x: displayClickX * scale,
        y: displayClickY * scale
    };
    
    for (const obj of level.value.objectsToFind) {
        if (!isFound(obj.id)) {
            const { x, y, width, height } = obj.coords;
            
            // 난이도 하향: 정답 영역의 중심점을 기준으로 클릭 거리를 계산
            const objectCenterX = x + width / 2;
            const objectCenterY = y + height / 2;
            const distance = Math.sqrt(
                Math.pow(clickCoords.x - objectCenterX, 2) + 
                Math.pow(clickCoords.y - objectCenterY, 2)
            );
            
            // 오브젝트의 대각선 길이 절반을 기준으로 판정 범위를 넓게 설정
            const toleranceRadius = Math.sqrt(width*width + height*height) / 2 * 1.5;

            if (distance < toleranceRadius) {
                try {
                    const foundHiddenObject = httpsCallable(functions, 'foundHiddenObject');
                    const result = await foundHiddenObject({ objectId: obj.id });
                    
                    if (result.data.correct) {
                        foundObjects.value.push({ id: obj.id });
                        if (result.data.allFound) {
                            endGame('win', result.data.reward);
                        }
                    }
                } catch (e) { console.error("오브젝트 확인 오류:", e); }
                return;
            }
        }
    }
};

const endGame = (status, reward = 0) => {
    clearInterval(timerInterval);
    gameResult.status = status;
    if (status === 'win') {
        gameResult.title = '🎉 모든 물건 발견! 🎉';
        gameResult.message = `성공 보상으로 ${reward.toLocaleString()} SaltMate를 획득했습니다!`;
    } else {
        gameResult.title = '⏱️ 시간 초과 ⏱️';
        gameResult.message = '아쉽지만 다음 기회에 다시 도전해주세요.';
    }
};

onMounted(async () => {
  try {
    const startHiddenObjectGame = httpsCallable(functions, 'startHiddenObjectGame');
    const result = await startHiddenObjectGame();
    level.value = assignImageUrl(result.data.level);
    isLoading.value = false;

    timerInterval = setInterval(() => {
        timer.value--;
        if (timer.value <= 0) {
            endGame('lose');
        }
    }, 1000);
  } catch (e) {
    console.error("게임 시작 오류:", e);
    alert(`게임 시작 중 오류가 발생했습니다: ${e.message}`);
    router.push('/dashboard');
  }
});

onUnmounted(() => {
    clearInterval(timerInterval);
});
</script>

<style scoped>
.hidden-object-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: #f0f2f5;
  min-height: calc(100vh - 70px);
}

.loading-overlay {
  position: fixed; inset: 0; display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(5px); z-index: 100;
}
.loading-overlay p { margin-top: 20px; font-size: 1.2em; font-weight: 500; color: #555; }
.spinner-large {
  border: 5px solid rgba(0, 0, 0, 0.1); border-top-color: #007bff;
  border-radius: 50%; width: 60px; height: 60px;
  animation: spin 1s linear infinite;
}

/* [UI/UX 개선] 게임 콘텐츠 레이아웃 */
.game-content {
  width: 100%;
  max-width: 1200px; /* 최대 너비 설정 */
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  text-align: center;
  width: 100%;
}
.page-header h1 { font-size: 2.2em; margin-bottom: 10px; }
.page-header p { font-size: 1.1em; color: #555; }

.ui-panel.card {
  background: white; border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0,0,0,0.08);
  padding: 20px;
  display: grid; /* [UI/UX 개선] 그리드 레이아웃으로 변경 */
  grid-template-columns: 1fr 2fr;
  align-items: center;
  gap: 20px;
}

.panel-header { text-align: center; padding-right: 20px; border-right: 1px solid #eee; }
.timer-container h3 { margin: 0 0 10px; font-size: 1.2em; color: #555; font-weight: 500; }
.timer { font-family: monospace; font-size: 2.5em; font-weight: bold; color: #dc3545; }

.panel-subheader { display: none; } /* 기존 헤더는 숨김 */

.object-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; /* [UI/UX 개선] 가로로 배치 */
  justify-content: space-around;
  gap: 15px;
}
.object-list li {
  display: flex; align-items: center; gap: 12px; font-size: 1.1em;
  padding: 12px; border-radius: 8px; transition: all 0.3s;
}
.object-list li.found { color: #999; text-decoration: line-through; background-color: #f8f9fa; }
.checkbox {
  width: 22px; height: 22px; border: 2px solid #ccc; border-radius: 50%;
  display: flex; justify-content: center; align-items: center; flex-shrink: 0;
}
li.found .checkbox { border-color: #28a745; background-color: #28a745; color: white; }

.image-area {
  position: relative;
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  width: 100%; /* [UI/UX 개선] 너비를 100%로 설정하여 모바일에서 꽉 차게 */
}
.image-area img { display: block; width: 100%; height: auto; }

/* [피드백 개선] 클릭/터치 피드백 마커 스타일 */
.click-feedback-marker {
  position: absolute;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.8);
  background-color: rgba(0, 123, 255, 0.5);
  transform: translate(-50%, -50%) scale(0);
  animation: click-pop 0.4s ease-out;
  pointer-events: none; /* 클릭 이벤트에 영향 주지 않도록 설정 */
}
@keyframes click-pop {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.2); }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}

.found-marker {
  position: absolute; border: 4px solid #ffd700; border-radius: 50%;
  box-shadow: 0 0 20px #ffd700, inset 0 0 15px rgba(255, 215, 0, 0.5);
  transform: scale(0);
  animation: found-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  pointer-events: none;
}
@keyframes found-pop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.sparkle {
  position: absolute; width: 100%; height: 100%;
  background-image: 
    radial-gradient(circle, white 10%, transparent 11%),
    radial-gradient(circle, white 10%, transparent 11%);
  background-size: 30px 30px; background-position: 0 0, 15px 15px;
  animation: sparkle-anim 0.8s ease-out forwards;
}
@keyframes sparkle-anim { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }

.game-over-modal {
  position: fixed; inset: 0; display: flex; justify-content: center; align-items: center;
  background-color: rgba(0,0,0,0.7); z-index: 100;
}
.modal-content {
  background: white; padding: 40px; border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); text-align: center;
  width: 90%; max-width: 400px; animation: fadeIn 0.5s ease-out;
}
.modal-content h2 { font-size: 2em; margin: 0 0 20px; }
.modal-content p { font-size: 1.2em; color: #555; margin-bottom: 30px; }
.btn-primary {
  padding: 12px 25px; border: none; background-color: #007bff;
  color: white; font-weight: bold; border-radius: 8px; cursor: pointer;
  text-decoration: none; font-size: 1.1em;
}

/* [UI/UX 개선] 모바일 화면 대응 */
@media (max-width: 768px) {
  .ui-panel.card {
    grid-template-columns: 1fr; /* 세로로 쌓이도록 변경 */
    gap: 15px;
  }
  .panel-header {
    padding-right: 0;
    border-right: none;
    border-bottom: 1px solid #eee; /* 아래쪽에 구분선 추가 */
    padding-bottom: 15px;
  }
  .object-list {
    flex-direction: column; /* 목록을 세로로 쌓음 */
    align-items: flex-start;
  }
}

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>