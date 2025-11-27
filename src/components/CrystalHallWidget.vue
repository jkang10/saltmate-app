<template>
  <div class="crystal-hall-widget card">
    <div class="widget-header">
      <h3><i class="fas fa-gem"></i> 명예의 결정실</h3>
      <p>위대한 노력의 결실, 영원히 빛나는 이름들</p>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
    </div>

    <div v-else-if="heirlooms.length > 0" class="showcase-container">
      <div class="crystal-track">
	<div 
	  v-for="item in heirlooms" 
	  :key="item.id" 
	  class="crystal-card"
	  :class="getTierClass(item.tier)"
	>
          <div class="glow-bg"></div>
          <div class="crystal-visual">
            <img :src="getCrystalImage(item.tier)" alt="Crystal" class="crystal-img" />
            <div class="shine-effect"></div>
          </div>
          <div class="owner-info">
            <span class="tier-badge">{{ item.tier }}</span>
            <strong class="owner-name">{{ item.ownerName }}</strong>
            <small class="date">{{ formatDate(item.createdAt) }}</small>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-data">
      <i class="fas fa-box-open"></i>
      <p>아직 전시된 명예의 결정이 없습니다.<br>첫 번째 주인공이 되어보세요!</p>
    </div>
    
    <div class="action-area">
        <router-link to="/crystal-hall" class="enter-btn">
            입장하기 <i class="fas fa-arrow-right"></i>
        </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebaseConfig';

// 이미지 에셋 (파일 경로가 정확한지 확인해주세요)
import imgBronze from '@/assets/game_assets/crystal_lv5_bronze.png';
import imgSilver from '@/assets/game_assets/crystal_lv5_bronze.png'; // 이미지가 없다면 대체
import imgGold from '@/assets/game_assets/crystal_lv5_vip.png'; // VIP용
import imgInfinite from '@/assets/game_assets/crystal_lv5_infinite.png';

const heirlooms = ref([]);
const loading = ref(true);

const getRecentCrystals = httpsCallable(functions, 'getRecentCrystalHeirlooms');

onMounted(async () => {
  try {
    const result = await getRecentCrystals();
    heirlooms.value = result.data.heirlooms;
  } catch (error) {
    console.error("결정실 데이터 로드 실패:", error);
  } finally {
    loading.value = false;
  }
});

const getCrystalImage = (tier) => {
  const t = tier?.toUpperCase() || '';
  if (t.includes('VIP')) return imgGold;
  if (t.includes('INFINITE')) return imgInfinite;
  if (t.includes('PREMIUM')) return imgSilver;
  return imgBronze; // 기본값
};

const getTierClass = (tier) => {
  const t = tier?.toUpperCase() || '';
  if (t.includes('VIP')) return 'style-vip';
  if (t.includes('INFINITE')) return 'style-infinite';
  return 'style-normal';
};

const formatDate = (isoString) => {
  const date = new Date(isoString);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};
</script>

<style scoped>
/* --- 1. 위젯 컨테이너: 깊이감 있는 배경과 반딧불이 효과 --- */
.crystal-hall-widget {
  /* 깊고 신비로운 밤하늘/동굴 느낌의 그라데이션 배경 */
  background: radial-gradient(circle at 50% 0%, #2a2356 0%, #120f24 60%, #080613 100%);
  border: 1px solid rgba(255, 255, 255, 0.15); /* 더 선명한 테두리 */
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 60px rgba(138, 43, 226, 0.2); /* 내/외부 광채 */
  color: white;
  overflow: hidden;
  position: relative;
  min-height: 340px; /* 높이 약간 증가 */
  display: flex;
  flex-direction: column;
  border-radius: 20px; /* 더 둥근 모서리 */
}

/* 반딧불이/펄 파티클 효과 (가상 요소 활용) */
.crystal-hall-widget::before,
.crystal-hall-widget::after {
  content: '';
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; /* 클릭 방지 */
  z-index: 1;
}

/* 첫 번째 레이어: 은은하게 떠다니는 큰 빛무리 */
.crystal-hall-widget::before {
  background-image: 
    radial-gradient(circle at 20% 30%, rgba(138, 43, 226, 0.2) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(41, 128, 185, 0.2) 0%, transparent 50%);
  animation: pulse-glow 15s ease-in-out infinite alternate;
}

/* 두 번째 레이어: 반짝이며 날아다니는 작은 펄(반딧불이) */
.crystal-hall-widget::after {
  background-image: 
    radial-gradient(circle, rgba(255, 255, 255, 0.8) 1px, transparent 2px),
    radial-gradient(circle, rgba(255, 215, 0, 0.6) 1px, transparent 2px),
    radial-gradient(circle, rgba(138, 43, 226, 0.7) 2px, transparent 3px);
  background-size: 60px 60px, 90px 90px, 120px 120px;
  background-position: 0 0, 30px 30px, 60px 0;
  animation: particle-move 20s linear infinite;
  opacity: 0.6;
}

/* --- 2. 헤더: 가독성 및 화려함 강화 --- */
.widget-header {
  text-align: center;
  padding: 20px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 2;
  position: relative;
  /* 헤더 배경에 살짝 빛 추가 */
  background: radial-gradient(ellipse at top, rgba(138, 43, 226, 0.2) 0%, transparent 70%);
}
.widget-header h3 {
  margin: 0;
  font-size: 1.8rem; /* 크기 확대 */
  font-weight: 800;
  letter-spacing: 1px;
  /* 화려한 금속성 텍스트 그라데이션 */
  background: linear-gradient(to bottom, #ffffff, #e2e2e2, #a8c0ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  /* 텍스트 그림자로 가독성 및 입체감 확보 */
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5), 0 0 20px rgba(138, 43, 226, 0.4);
}
.widget-header h3 i {
    color: #a8c0ff; /* 아이콘 색상 별도 지정 */
    margin-right: 8px;
}
.widget-header p {
  margin: 8px 0 0;
  font-size: 1rem;
  color: #d1d1e9; /* 더 밝은 회색으로 가독성 향상 */
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* --- 3. 콘텐츠 영역 --- */
.showcase-container {
  flex-grow: 1;
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 30px 20px; /* 상하 패딩 증가로 여유 공간 확보 */
  scrollbar-width: none; 
  -ms-overflow-style: none;
  z-index: 2; /* 배경 효과 위로 */
}
.showcase-container::-webkit-scrollbar { display: none; }

.crystal-track {
  display: flex;
  gap: 25px; /* 카드 간격 증가 */
  padding: 0 10px;
}

/* --- 4. 결정 카드: 고급스러운 유리(Glassmorphism) 효과 --- */
.crystal-card {
  flex-shrink: 0;
  width: 180px; /* 카드 크기 확대 */
  /* 더 투명하고 반짝이는 유리 질감 */
  background: rgba(255, 255, 255, 0.07);
  border-radius: 20px;
  padding: 20px 15px;
  text-align: center;
  position: relative;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); /* 부드러운 전환 */
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px); /* 블러 효과 강화 */
  box-shadow: 0 5px 15px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.1);
  overflow: hidden; /* 내부 광원 효과가 밖으로 나가지 않게 */
}

/* 호버 시 효과 강화 */
.crystal-card:hover {
  transform: translateY(-15px) scale(1.03);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(255,255,255,0.2);
  border-color: rgba(255, 255, 255, 0.5);
  z-index: 10;
}
/* 호버 시 내부에 빛이 지나가는 효과 */
.crystal-card:hover::after {
    content: '';
    position: absolute;
    top: -50%; left: -50%; width: 200%; height: 200%;
    background: linear-gradient(to bottom right, transparent, rgba(255,255,255,0.3), transparent);
    transform: rotate(45deg);
    animation: shine-pass 1s forwards;
}

/* --- 5. 등급별 스타일 (더 강력한 광채) --- */
.crystal-card.style-vip {
  box-shadow: 0 5px 20px rgba(255, 215, 0, 0.3), inset 0 0 10px rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.5);
}
.crystal-card.style-vip .tier-badge {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #333;
  box-shadow: 0 2px 5px rgba(255, 215, 0, 0.4);
}

.crystal-card.style-infinite {
  box-shadow: 0 5px 20px rgba(138, 43, 226, 0.4), inset 0 0 10px rgba(138, 43, 226, 0.2);
  border-color: rgba(138, 43, 226, 0.6);
}
.crystal-card.style-infinite .tier-badge {
  background: linear-gradient(135deg, #8A2BE2, #4B0082);
  box-shadow: 0 2px 5px rgba(138, 43, 226, 0.5);
}

/* --- 6. 결정 비주얼 및 정보 --- */
.crystal-visual {
  position: relative;
  height: 120px; /* 높이 증가 */
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 15px;
}
.crystal-img {
  width: 100px; /* 이미지 크기 확대 */
  height: 100px;
  object-fit: contain;
  /* 더 강한 발광 효과 및 그림자 */
  filter: drop-shadow(0 5px 15px rgba(138, 43, 226, 0.6));
  animation: float 4s ease-in-out infinite; /* 부유 애니메이션 속도 조절 */
}
/* 결정 뒤의 후광 효과 */
.shine-effect {
  position: absolute;
  top: 50%; left: 50%; width: 140%; height: 140%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(138,43,226,0.2) 40%, transparent 70%);
  animation: pulse-shine 3s infinite alternate; /* 맥박처럼 빛남 */
  pointer-events: none;
}

.owner-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tier-badge {
  font-size: 0.8rem;
  padding: 4px 12px;
  border-radius: 20px;
  background: #444;
  align-self: center;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.owner-name {
  font-size: 1.1rem; /* 폰트 크기 확대 */
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 4px rgba(0,0,0,0.6); /* 텍스트 그림자로 가독성 확보 */
}
.date {
  font-size: 0.85rem;
  color: #b0b0c0; /* 더 밝은 회색 */
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* --- 7. 기타 요소 (로딩, 데이터 없음, 하단) --- */
.no-data {
  flex-grow: 1;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  color: #a8a8b3; gap: 15px; z-index: 2;
}
.no-data i { font-size: 3rem; color: #6c5ce7; opacity: 0.8; }
.no-data p { font-size: 1.1rem; line-height: 1.6; }

.action-area {
    text-align: right;
    padding: 15px;
    border-top: 1px solid rgba(255,255,255,0.1);
    z-index: 2;
    background: rgba(0,0,0,0.1);
}
.enter-btn {
    color: #a8c0ff;
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: bold;
    transition: all 0.3s;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 15px;
    border-radius: 20px;
    background: rgba(255,255,255,0.05);
}
.enter-btn:hover {
    color: #fff;
    background: rgba(168, 192, 255, 0.2);
    box-shadow: 0 0 15px rgba(168, 192, 255, 0.4);
}

.loading-container {
    display: flex; justify-content: center; align-items: center; height: 250px; z-index: 2;
}
.spinner {
  border: 4px solid rgba(168, 192, 255, 0.2);
  border-radius: 50%;
  border-top: 4px solid #a8c0ff;
  width: 40px; height: 40px;
  animation: spin 1s linear infinite;
  box-shadow: 0 0 15px rgba(168, 192, 255, 0.4);
}

/* --- 8. 애니메이션 정의 --- */
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-12px) rotate(2deg); }
}
@keyframes pulse-shine {
  0% { opacity: 0.4; transform: translate(-50%, -50%) scale(0.9); }
  100% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.1); }
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* 배경 파티클/광원 애니메이션 */
@keyframes pulse-glow {
  0% { opacity: 0.4; } 100% { opacity: 0.8; }
}
@keyframes particle-move {
  0% { background-position: 0 0, 30px 30px, 60px 0; }
  100% { background-position: 100px -100px, 130px -70px, 160px -100px; }
}
@keyframes shine-pass {
    0% { left: -50%; opacity: 0; }
    50% { opacity: 1; }
    100% { left: 150%; opacity: 0; }
}
</style>