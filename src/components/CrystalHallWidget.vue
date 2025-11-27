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
/* --- 1. 위젯 컨테이너 --- */
.crystal-hall-widget {
  /* (배경은 기존 설정 유지하거나, 이미지처럼 밝게 하셨다면 그에 맞춤) */
  /* 이 코드는 다크 테마 기준이지만, 글씨 테두리를 추가하여 밝은 배경에서도 잘 보이게 합니다 */
  background: radial-gradient(circle at 50% 0%, #ffffff 0%, #f0f0f0 60%, #e0e0e0 100%); /* (참고) 밝은 배경 예시 */
  /* 만약 기존 어두운 배경을 원하시면 위 background 줄을 지우고 이전 배경을 쓰세요. */
  
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  color: white;
  overflow: hidden;
  position: relative;
  min-height: 340px;
  display: flex;
  flex-direction: column;
  border-radius: 20px;
}

/* --- 2. 헤더: 검은 테두리로 시인성 극대화 --- */
.widget-header {
  text-align: center;
  padding: 25px 15px 10px;
  z-index: 2;
  position: relative;
}

.widget-header h3 {
  margin: 0 0 5px 0;
  font-size: 1.8rem;
  font-weight: 900;
  letter-spacing: 1px;
  color: #fff;
  /* ▼▼▼ [핵심] 선명한 검은색 테두리 효과 ▼▼▼ */
  text-shadow: 
    -1px -1px 0 #000,  
     1px -1px 0 #000,
    -1px  1px 0 #000,
     1px  1px 0 #000,
     0 2px 5px rgba(0,0,0,0.5); /* 그림자 추가 */
  /* ▲▲▲ */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.widget-header h3 i {
    color: #fff;
    /* 아이콘에도 테두리 적용 */
    text-shadow: 
    -1px -1px 0 #000,  
     1px -1px 0 #000,
    -1px  1px 0 #000,
     1px  1px 0 #000;
}

.widget-header p {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  /* 본문에도 검은색 테두리 적용 */
  text-shadow: 
    -1px -1px 0 #000,  
     1px -1px 0 #000,
    -1px  1px 0 #000,
     1px  1px 0 #000;
  opacity: 0.9;
}

/* --- 3. 콘텐츠 영역 --- */
.showcase-container {
  flex-grow: 1;
  display: flex;
  align-items: center;
  overflow-x: auto;
  padding: 10px 20px;
  scrollbar-width: none; 
  -ms-overflow-style: none;
  z-index: 2;
}
.showcase-container::-webkit-scrollbar { display: none; }

.crystal-track {
  display: flex;
  gap: 20px;
  padding: 0 10px;
}

/* --- 4. 결정 카드 --- */
.crystal-card {
  flex-shrink: 0;
  width: 160px;
  background: rgba(255, 255, 255, 0.8); /* 카드 배경을 좀 더 불투명하게 */
  border-radius: 20px;
  padding: 15px;
  text-align: center;
  position: relative;
  transition: all 0.3s ease;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.crystal-card:hover {
  transform: translateY(-10px) scale(1.03);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

/* 등급별 스타일 */
.crystal-card.style-vip { border: 2px solid #FFD700; }
.crystal-card.style-vip .tier-badge { background: linear-gradient(45deg, #FFD700, #FFA500); color: #000; }

.crystal-card.style-infinite { border: 2px solid #8A2BE2; }
.crystal-card.style-infinite .tier-badge { background: linear-gradient(45deg, #8A2BE2, #4B0082); color: #fff; }

.crystal-visual {
  position: relative;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
}
.crystal-img {
  width: 90px;
  height: 90px;
  object-fit: contain;
  filter: drop-shadow(0 5px 10px rgba(0,0,0,0.2));
  animation: float 3s ease-in-out infinite;
}

.owner-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tier-badge {
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 15px;
  background: #666;
  color: white;
  align-self: center;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.owner-name {
  font-size: 1rem;
  font-weight: 800;
  color: #333; /* 카드 내부는 밝은 배경이므로 검은 글씨 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.date {
  font-size: 0.8rem;
  color: #666;
  font-weight: 600;
}

/* --- 5. 하단 버튼 및 기타 (수정됨) --- */
.action-area {
    text-align: right;
    padding: 15px 20px;
    /* ▼▼▼ 회색 배경 제거 ▼▼▼ */
    background: transparent; 
    border-top: none;
    /* ▲▲▲ */
    z-index: 2;
}

.enter-btn {
    /* ▼▼▼ 버튼 자체를 선명하게 디자인 ▼▼▼ */
    display: inline-flex; 
    align-items: center; 
    gap: 8px;
    padding: 10px 20px;
    border-radius: 30px;
    background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); /* 파란/보라 그라데이션 */
    color: #fff;
    text-decoration: none;
    font-size: 1rem;
    font-weight: bold;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
}
.enter-btn:hover {
    transform: translateX(5px);
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
    filter: brightness(1.1);
}
.enter-btn i { font-size: 0.9rem; }

.no-data {
  flex-grow: 1;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  color: #555; gap: 10px; z-index: 2; text-align: center;
}
.no-data i { font-size: 3rem; color: #ccc; }
.no-data p { font-size: 1rem; font-weight: 500; }

.loading-container {
    display: flex; justify-content: center; align-items: center; height: 250px; z-index: 2;
}
.spinner {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top: 3px solid #007bff;
  width: 30px; height: 30px;
  animation: spin 1s linear infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>