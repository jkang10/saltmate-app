<template>
  <div class="click-ranking-widget card">
    <div class="widget-header">
      <h3><i class="fas fa-bolt"></i> 광클의 제왕</h3>
      <p>가장 빠른 손가락을 가진 전설들</p>
    </div>
    <div v-if="loading" class="loading-spinner"></div>
    <ul v-else-if="rankings.length > 0" class="ranking-list">
      <li v-for="(player, index) in rankings" :key="index" :class="['rank-item', 'rank-' + (index + 1)]">
	<div class="rank-icon">
	    <i v-if="index === 0" class="fas fa-crown"></i>
	    <i v-else-if="index === 1" class="fas fa-medal"></i>
	    <i v-else-if="index === 2" class="fas fa-award"></i>
	    <span v-else>{{ index + 1 }}</span>
	</div>
        <span class="player-name">{{ player.userName }}</span>
        <span class="player-clicks">{{ player.totalClicks.toLocaleString() }} <small>클릭</small></span>
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
    const getRankings = httpsCallable(functions, "getSaltMineClickRankings");
    const result = await getRankings();
    rankings.value = result.data.rankings;
  } catch (error) {
    console.error("클릭 랭킹 로딩 실패:", error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* [수정] text-glow 키프레임은 더 이상 사용하지 않으므로 삭제하고, background-pan과 spin만 남깁니다. */
@keyframes background-pan {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes spin { to { transform: rotate(360deg); } }

.click-ranking-widget {
  background: linear-gradient(-45deg, #1a2333, #3a4a6d, #1a2333, #536286) !important;
  background-size: 400% 400% !important;
  animation: background-pan 15s ease infinite;
  border: 1px solid #5a6a8a !important;
  color: #fff !important;
  transition: all 0.3s ease;
}
.click-ranking-widget:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}

.widget-header { text-align: center; margin-bottom: 20px; }

/* ▼▼▼ [핵심 수정] 헤더(h3) 스타일 변경 ▼▼▼ */
.widget-header h3 {
  font-size: 1.8em;
  font-weight: 700;
  color: #fff; /* 색상을 흰색으로 변경 */
  display: flex; align-items: center; justify-content: center; gap: 12px;
  /* text-glow 애니메이션 제거 */
  text-shadow: 0 2px 4px rgba(0,0,0,0.5); /* 깔끔한 기본 그림자 효과로 대체 */
}
/* ▲▲▲ 수정된 부분 끝 ▲▲▲ */

.widget-header p {
  font-size: 0.9em;
  color: #bdc3c7;
  margin-top: 5px;
}

.ranking-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }

.rank-item {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  gap: 15px;
  align-items: center;
  padding: 10px 15px;
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
}
.rank-1 .rank-icon { color: #f1c40f; font-size: 1.6em; }
.rank-2 .rank-icon { color: #e0e0e0; }
.rank-3 .rank-icon { color: #cd7f32; }
.rank-icon span {
  font-size: 1.1rem;
  color: #94a3b8;
}

.player-name {
  font-size: 1.05em;
  font-weight: 600;
  color: #ecf0f1;
}

.player-clicks {
  font-size: 1.3em;
  font-weight: 700;
  white-space: nowrap;
  
  background: linear-gradient(90deg, #ffeb3b, #ffc107, #ff9800, #ffeb3b);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: text-shine 3s linear infinite;
}
@keyframes text-shine {
  to {
    background-position: 200% center;
  }
}
.player-clicks small {
  font-size: 0.7em;
  color: #bdc3c7;
  background: none;
  -webkit-background-clip: initial;
  background-clip: initial;
  color: #bdc3c7;
}

.no-data { text-align: center; padding: 20px; color: #94a3b8; }
.loading-spinner {
  margin: 20px auto;
  display: block;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ffc107;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
</style>