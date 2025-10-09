<template>
  <div class="widget-card enchant-rank-widget">
    <div class="widget-header">
      <h4><i class="fas fa-hammer"></i> 소금 강화 랭킹 TOP 7</h4>
    </div>
    <div class="widget-body">
      <div v-if="isLoading" class="loading-spinner"></div>
      <div v-else-if="rankings.length > 0" class="ranking-container">
        <div class="podium">
          <div v-if="rankings[1]" class="podium-item rank-2">
            <div class="player-info">
              <div class="rank-icon" v-html="getRankIcon(1)"></div>
              <div class="player-name">{{ rankings[1].userName }}</div>
              <div class="player-score">+{{ rankings[1].level }}</div>
            </div>
          </div>
          <div v-if="rankings[0]" class="podium-item rank-1">
             <div class="player-info">
              <div class="rank-icon" v-html="getRankIcon(0)"></div>
              <div class="player-name">{{ rankings[0].userName }}</div>
              <div class="player-score">+{{ rankings[0].level }}</div>
            </div>
          </div>
          <div v-if="rankings[2]" class="podium-item rank-3">
             <div class="player-info">
              <div class="rank-icon" v-html="getRankIcon(2)"></div>
              <div class="player-name">{{ rankings[2].userName }}</div>
              <div class="player-score">+{{ rankings[2].level }}</div>
            </div>
          </div>
        </div>

        <ul v-if="rankings.length > 3" class="lower-ranks">
          <li v-for="(player, index) in rankings.slice(3)" :key="player.userId">
            <span class="rank">{{ index + 4 }}</span>
            <span class="name">{{ player.userName }}</span>
            <span class="score">+{{ player.level }} {{ player.itemName }}</span>
          </li>
        </ul>
      </div>
      <div v-else class="no-data">
        <p>랭킹 데이터가 없습니다.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const isLoading = ref(true);
const rankings = ref([]);

const getRankIcon = (index) => {
  if (index === 0) return '<i class="fas fa-crown"></i>';
  if (index === 1) return '<i class="fas fa-medal"></i>';
  if (index === 2) return '<i class="fas fa-award"></i>';
  return index + 1;
};

const fetchRankings = async () => {
  isLoading.value = true;
  try {
    const getEnchantRankings = httpsCallable(functions, 'getEnchantRankings');
    const result = await getEnchantRankings();
    rankings.value = result.data.rankings;
  } catch (error) {
    console.error("강화 랭킹 로딩 실패:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchRankings);
</script>

<style scoped>
.widget-card {
  background: linear-gradient(180deg, #2c3e50 0%, #1a2533 100%);
  color: #ecf0f1;
  border-radius: 10px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  border: 1px solid #4a6fa1;
  position: relative;
  overflow: hidden;
}
.widget-header {
  margin-bottom: 20px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 15px;
}
.widget-header h4 {
  margin: 0;
  font-size: 1.3em;
  color: white;
  text-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* 명예의 단상 (Podium) 스타일 */
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 10px;
  height: 180px;
  margin-bottom: 20px;
}
.podium-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* [수정] justify-content를 flex-end -> center 로 변경 */
  justify-content: center; 
  border-radius: 10px;
  width: 30%;
  transition: all 0.3s ease;
  border-top-width: 4px;
  border-top-style: solid;
  position: relative;
}
.player-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    width: 100%;
}
.rank-icon { font-size: 2em; margin-bottom: 8px; }
.player-name { 
  font-weight: bold; 
  font-size: 1.1em; 
  text-overflow: ellipsis; 
  overflow: hidden; 
  white-space: nowrap; 
  width: 100%;
  text-align: center;
}
.player-score { font-size: 1.3em; font-weight: 700; font-family: monospace; }

/* 1등 스타일 */
.rank-1 {
  height: 100%;
  order: 2;
  background: rgba(255, 215, 0, 0.15);
  border-color: #ffd700;
  box-shadow: 0 0 25px rgba(255, 215, 0, 0.4);
  animation: pulse-gold 2s infinite;
}
.rank-1 .rank-icon :deep(.fa-crown) { color: #ffd700; }
.rank-1 .player-score { color: #ffd700; }

/* [핵심 추가] 1등 반짝이는 효과 */
.rank-1::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 200%;
  padding-bottom: 200%;
  border-radius: 50%;
  background-image: radial-gradient(rgba(255, 255, 255, 0.3), transparent 50%);
  transform: translate(-50%, -50%);
  animation: sparkle 3s linear infinite;
  pointer-events: none;
}
@keyframes sparkle {
  0% { transform: translate(-50%, -50%) rotate(0deg) scale(0); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(180deg) scale(1.5); opacity: 0; }
}
.click-ranking-widget:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}
/* 2등, 3등 및 나머지 스타일 */
.rank-2 { height: 80%; order: 1; background: rgba(192, 192, 192, 0.15); border-color: #c0c0c0; }
.rank-2 .rank-icon :deep(.fa-medal) { color: #c0c0c0; }
.rank-3 { height: 60%; order: 3; background: rgba(205, 127, 50, 0.15); border-color: #cd7f32; }
.rank-3 .rank-icon :deep(.fa-award) { color: #cd7f32; }

.lower-ranks { list-style: none; padding: 0; margin: 15px 0 0; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 15px; }
.lower-ranks li { display: grid; grid-template-columns: 30px 1fr auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 5px; }
.lower-ranks .rank { font-weight: bold; text-align: center; color: #95a5a6; }
/* [핵심 수정] 아래쪽 랭킹 이름도 중앙 정렬 */
.lower-ranks .name { font-weight: 500; text-align: center; } 
.lower-ranks .score { font-family: monospace; }

.loading-spinner, .no-data { text-align: center; padding: 20px; color: #95a5a6; }
.loading-spinner { border: 3px solid rgba(255, 255, 255, 0.2); border-top-color: #fff; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse-gold {
  0% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.4); }
  50% { box-shadow: 0 0 40px rgba(255, 215, 0, 0.8); }
  100% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.4); }
}
</style>