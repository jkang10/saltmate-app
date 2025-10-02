<template>
  <div class="pvp-rankings-widget feature-card">
    <div class="widget-header">
      <div class="card-icon"><i class="fas fa-fist-raised"></i></div>
      <h3>주간 대전 랭킹 TOP 7</h3>
    </div>
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-small"></div>
    </div>
    <ul v-else-if="rankings.length > 0" class="ranking-list">
      <li
        v-for="(player, index) in rankings"
        :key="player.userId"
        :class="['rank-' + (index + 1)]"
      >
        <div class="rank-badge">
          <i v-if="index === 0" class="fas fa-crown"></i>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <span class="player-name">{{ player.userName }}</span>
        <span class="player-score">{{ player.wins.toLocaleString() }}승</span>
      </li>
    </ul>
    <div v-else class="no-data">
      지난 주 랭킹이 없습니다.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const rankings = ref([]);
const isLoading = ref(true);

const fetchPvpRankings = async () => {
  try {
    // 지난주 랭킹을 가져오기 위해 지난주 월요일 날짜를 계산
    const today = new Date();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - today.getDay());
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    const lastWeekId = lastMonday.toISOString().slice(0, 10);

    const q = query(
      collection(db, `leaderboards/pvp_weekly_wins/${lastWeekId}`),
      orderBy("rank", "asc"),
      limit(7)
    );
    const snapshot = await getDocs(q);
    rankings.value = snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("주간 대전 랭킹 로딩 오류:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchPvpRankings);
</script>

<style scoped>
.pvp-rankings-widget {
  background: linear-gradient(135deg, #485461, #28313b) !important;
  color: #ecf0f1;
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.widget-header {
  display: flex; align-items: center; gap: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 15px; margin-bottom: 15px;
}
.widget-header .card-icon { font-size: 1.8em; color: #e74c3c; }
.widget-header h3 { font-size: 1.4em; margin: 0; color: #fff; }
.loading-state, .no-data { flex-grow: 1; display: flex; justify-content: center; align-items: center; font-style: italic; color: #bdc3c7; }
.spinner-small { border: 3px solid rgba(255, 255, 255, 0.2); border-top-color: #fff; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ranking-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; flex-grow: 1; justify-content: center; }
.ranking-list li { display: flex; align-items: center; padding: 10px; border-radius: 8px; background-color: rgba(255, 255, 255, 0.05); font-size: 1.1em; position: relative; overflow: hidden; }
.rank-badge { width: 35px; font-weight: bold; font-size: 1.2em; text-align: center; margin-right: 15px; }
.player-name { flex-grow: 1; color: #fff; }
.player-score { font-weight: bold; color: #fff; }
.rank-1 {
  background: linear-gradient(-45deg, #e74c3c, #c0392b, #e74c3c, #c0392b);
  background-size: 400% 400%; animation: gradient-animation 5s ease infinite;
  color: #fff; font-weight: bold; border: 2px solid #fff; box-shadow: 0 0 15px #e74c3c;
}
.rank-1::before { content: ''; position: absolute; top: -50%; left: -50%; width: 0; height: 200%; background: rgba(255, 255, 255, 0.4); transform: rotate(45deg); animation: shine-animation 3s infinite linear; }
.rank-1 .rank-badge { color: #fff; text-shadow: 0 0 5px #000; animation: crown-glow 2s infinite alternate; }
.rank-2 { background-color: rgba(192, 192, 192, 0.2); }
.rank-3 { background-color: rgba(205, 127, 50, 0.2); }
.rank-2, .rank-3 { color: #fff; }
@keyframes gradient-animation { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes crown-glow { from { transform: scale(1); } to { transform: scale(1.2); } }
@keyframes shine-animation { 0% { left: -50%; width: 0; } 50% { left: 100%; width: 100%; } 100% { left: 100%; width: 0; } }
</style>