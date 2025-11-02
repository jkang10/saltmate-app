<template>
  <div class="ranking-widget card rich-list-glass">
    <div class="widget-header">
      <h3><i class="fas fa-crown"></i> 소금상인 GOLD 랭킹</h3>
      <p>가장 많은 골드를 보유한 거상들</p>
    </div>
    <div v-if="loading" class="loading-spinner"></div>
    <ul v-else-if="rankings.length > 0" class="ranking-list">
      <li v-for="(player, index) in rankings" :key="index" :class="['rank-item', 'rank-' + (index + 1)]">
	<div class="rank-icon">
	    <i v-if="index === 0" class="fas fa-crown"></i>
	    <span v-else>{{ index + 1 }}</span>
	</div>
        <span class="player-name">{{ player.userName }}</span>
        <span class="player-score">{{ player.totalGold.toLocaleString() }} G</span>
      </li>
    </ul>
    <p v-else class="no-data">랭킹 데이터가 없습니다.</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebaseConfig";

const rankings = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const getRankings = httpsCallable(functions, "getTotalGoldRankings");
    const result = await getRankings();
    rankings.value = result.data.rankings;
  } catch (error) {
    console.error("전체 골드 랭킹 로딩 실패:", error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* (SaltMineClickRankingsWidget와 유사한 어두운 테마) */
@keyframes background-pan {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes spin { to { transform: rotate(360deg); } }

.rich-list-glass {
  background: linear-gradient(-45deg, #1a2333, #3a4a6d, #1a2333, #536286) !important;
  background-size: 400% 400% !important;
  animation: background-pan 15s ease infinite;
  border: 1px solid #5a6a8a !important;
  color: #fff !important;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.widget-header { text-align: center; margin-bottom: 20px; }
.widget-header h3 {
  font-size: 1.8em;
  font-weight: 700;
  color: #FFD700; /* 금색 헤더 */
  display: flex; align-items: center; justify-content: center; gap: 12px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 0 10px rgba(255, 215, 0, 0.5);
}
.widget-header p { font-size: 0.9em; color: #bdc3c7; margin-top: 5px; }

.ranking-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px; /* 촘촘하게 */
}
.rank-item {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 15px;
  align-items: center;
  padding: 8px 15px;
  background: linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.1));
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  transition: all 0.3s ease;
}
.rank-item:hover {
  background: rgba(255,255,255,0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.rank-icon {
  font-size: 1.4em;
  font-weight: bold;
  text-align: center;
  color: #94a3b8; /* 기본 순위 */
}
.rank-1 .rank-icon { color: #f1c40f; font-size: 1.6em; }

.player-name {
  font-size: 1.05em;
  font-weight: 600;
  color: #ecf0f1;
}

.player-score {
  font-size: 1.3em;
  font-weight: 700;
  white-space: nowrap;
  color: #FFD700; /* 금색 점수 */
}

.no-data { text-align: center; padding: 20px; color: #94a3b8; }
.loading-spinner {
  margin: 20px auto;
  display: block;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #FFD700;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
</style>