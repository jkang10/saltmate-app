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
          v-for="(item, index) in heirlooms" 
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
.crystal-hall-widget {
  /* 고급스러운 어두운 배경 */
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  overflow: hidden;
  position: relative;
  min-height: 320px;
  display: flex;
  flex-direction: column;
}

.widget-header {
  text-align: center;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 2;
}
.widget-header h3 {
  margin: 0;
  font-size: 1.5rem;
  background: linear-gradient(to right, #fff, #e2e2e2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
}
.widget-header p {
  margin: 5px 0 0;
  font-size: 0.9rem;
  color: #a8a8b3;
}

.showcase-container {
  flex-grow: 1;
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 20px 0;
  /* 스크롤바 숨기기 */
  scrollbar-width: none; 
  -ms-overflow-style: none;
}
.showcase-container::-webkit-scrollbar { display: none; }

.crystal-track {
  display: flex;
  gap: 20px;
  padding: 0 20px;
}

/* 결정 카드 디자인 */
.crystal-card {
  flex-shrink: 0;
  width: 160px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 15px;
  padding: 15px;
  text-align: center;
  position: relative;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
}

.crystal-card:hover {
  transform: translateY(-10px) scale(1.05);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.5);
  border-color: rgba(255, 255, 255, 0.3);
  z-index: 10;
}

/* 등급별 스타일 */
.crystal-card.style-vip {
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
  border-color: rgba(255, 215, 0, 0.3);
}
.crystal-card.style-vip .tier-badge {
  background: linear-gradient(45deg, #FFD700, #FFA500);
  color: #000;
}

.crystal-card.style-infinite {
  box-shadow: 0 0 15px rgba(138, 43, 226, 0.3);
  border-color: rgba(138, 43, 226, 0.4);
}
.crystal-card.style-infinite .tier-badge {
  background: linear-gradient(45deg, #8A2BE2, #4B0082);
}

.crystal-visual {
  position: relative;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
}
.crystal-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.4));
  animation: float 3s ease-in-out infinite;
}
.shine-effect {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 60%);
  animation: pulse-shine 2s infinite;
}

.owner-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tier-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  background: #444;
  align-self: center;
  font-weight: bold;
}
.owner-name {
  font-size: 1rem;
  font-weight: bold;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.date {
  font-size: 0.8rem;
  color: #888;
}

.no-data {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #666;
  gap: 10px;
}
.no-data i { font-size: 2.5rem; }

.action-area {
    text-align: right;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.1);
}
.enter-btn {
    color: #a8c0ff;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: bold;
    transition: color 0.3s;
}
.enter-btn:hover {
    color: #fff;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes pulse-shine {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
}
.spinner {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 3px solid #fff;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>