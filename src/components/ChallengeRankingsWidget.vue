<template>
  <div class="challenge-rankings-widget feature-card">
    <div class="widget-header">
      <div class="card-icon"><i class="fas fa-trophy"></i></div>
      <h3>주간 명예의 전당</h3>
    </div>
    <div class="tabs">
      <button @click="activeTab = 'saltKing'" :class="{active: activeTab === 'saltKing'}">
        <i class="fas fa-gem"></i> 소금왕
      </button>
      <button @click="activeTab = 'seaExplorer'" :class="{active: activeTab === 'seaExplorer'}">
        <i class="fas fa-water"></i> 해양탐험가
      </button>
    </div>

    <div class="widget-body">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner-small"></div>
      </div>
      <ul v-else-if="currentRankings.length > 0" class="ranking-list">
        <li v-if="currentRankings[0]" class="rank-1">
          <div class="rank-badge"><i class="fas fa-crown"></i></div>
          <div class="player-info">
            <span class="player-name">{{ currentRankings[0].userName }}</span>
            <span class="player-score">{{ currentRankings[0].score.toLocaleString() }} {{ unit }}</span>
          </div>
          <div class="shine-effect"></div>
        </li>
        <li v-if="currentRankings[1]" class="rank-2">
          <div class="rank-badge"><span>2</span></div>
          <div class="player-info">
            <span class="player-name">{{ currentRankings[1].userName }}</span>
            <span class="player-score">{{ currentRankings[1].score.toLocaleString() }} {{ unit }}</span>
          </div>
        </li>
        <li v-if="currentRankings[2]" class="rank-3">
          <div class="rank-badge"><span>3</span></div>
          <div class="player-info">
            <span class="player-name">{{ currentRankings[2].userName }}</span>
            <span class="player-score">{{ currentRankings[2].score.toLocaleString() }} {{ unit }}</span>
          </div>
        </li>
      </ul>
      <div v-else class="no-data">
        <p>지난 주 기록이 없습니다.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const isLoading = ref(true);
const activeTab = ref('saltKing');
const rankings = ref({
  saltKing: [],
  seaExplorer: [],
});

const currentRankings = computed(() => rankings.value[activeTab.value]);
const unit = computed(() => activeTab.value === 'saltKing' ? 'Salt' : 'L');

const fetchRankings = async () => {
  isLoading.value = true;
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    const lastWeekId = lastMonday.toISOString().slice(0, 10);
    const challengeId = activeTab.value;

    const q = query(
      collection(db, 'challenges'),
      where('weekId', '==', lastWeekId),
      where('challengeId', '==', challengeId),
      orderBy('rank', 'asc'),
      limit(3)
    );
    const snapshot = await getDocs(q);
    rankings.value[challengeId] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`주간 챌린지(${activeTab.value}) 랭킹 로딩 실패:`, error);
  } finally {
    isLoading.value = false;
  }
};

watch(activeTab, fetchRankings);
onMounted(fetchRankings);
</script>

<style scoped>
.challenge-rankings-widget {
  background: linear-gradient(145deg, #34495e, #2c3e50) !important;
  color: #ecf0f1;
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.widget-header {
  display: flex; align-items: center; gap: 15px;
  padding-bottom: 15px; margin-bottom: 15px;
}
.widget-header .card-icon { font-size: 1.8em; color: #f1c40f; }
.widget-header h3 { font-size: 1.4em; margin: 0; color: #fff; }
.tabs {
  display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  background-color: rgba(0,0,0,0.2);
  border-radius: 8px; padding: 5px; margin-bottom: 20px;
}
.tabs button {
  padding: 10px; border: none; background-color: transparent;
  color: #bdc3c7; font-weight: bold; cursor: pointer;
  border-radius: 6px; transition: all 0.3s ease;
  display: flex; justify-content: center; align-items: center; gap: 8px;
}
.tabs button.active {
  background-color: #3498db; color: white;
  box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
}
.widget-body { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
.loading-state, .no-data { text-align: center; padding: 20px; color: #95a5a6; }
.spinner-small { border: 3px solid rgba(255, 255, 255, 0.2); border-top-color: #fff; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 0 auto; }
@keyframes spin { to { transform: rotate(360deg); } }
.ranking-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
.ranking-list li {
  display: flex; align-items: center; padding: 12px 15px;
  border-radius: 10px; font-size: 1.1em;
  position: relative; overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.rank-badge {
  width: 40px; height: 40px;
  display: flex; justify-content: center; align-items: center;
  font-weight: bold; font-size: 1.3em;
  margin-right: 15px; border-radius: 50%;
}
.player-info { display: flex; flex-direction: column; flex-grow: 1; }
.player-name { font-weight: 500; font-size: 1em; }
.player-score { font-family: monospace; font-size: 1.1em; opacity: 0.8; }

/* 1위 */
.rank-1 {
  background: linear-gradient(-45deg, #f1c40f, #e67e22, #f39c12, #f1c40f);
  background-size: 400% 400%; animation: gradient-animation 5s ease infinite;
  color: #2c3e50; border: 2px solid #fff;
  box-shadow: 0 0 20px #f1c40f; transform: scale(1.05);
}
.rank-1 .rank-badge { background: #fff; color: #f1c40f; animation: crown-glow 2s infinite alternate; }
.rank-1 .player-name, .rank-1 .player-score { font-weight: bold; }
.shine-effect {
  position: absolute; top: -50%; left: -100%; width: 75%; height: 200%;
  background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%);
  transform: rotate(25deg);
  animation: shine 3s infinite;
}

/* 2위 */
.rank-2 { background: rgba(192, 192, 192, 0.2); }
.rank-2 .rank-badge { background: #c0c0c0; color: #2c3e50; }

/* 3위 */
.rank-3 { background: rgba(205, 127, 50, 0.2); }
.rank-3 .rank-badge { background: #cd7f32; color: #fff; }

@keyframes gradient-animation { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes crown-glow { from { transform: scale(1); } to { transform: scale(1.2); } }
@keyframes shine { 100% { left: 150%; } }
</style>