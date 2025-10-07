<template>
  <div class="feature-card ranking-widget">
    <div class="card-icon"><i class="fas fa-shield-alt"></i></div>
    <h3>솔트 가디언즈 TOP 7 (일일)</h3>
    
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-small"></div>
    </div>
    <ul v-else-if="rankings.length > 0" class="ranking-list">
      <li v-for="(player, index) in rankings" :key="player.userId" :class="['rank-' + (index + 1)]">
        <div class="rank-badge">
          <i v-if="index === 0" class="fas fa-crown"></i>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <span class="player-name">{{ player.userName }}</span>
        <span class="player-score">{{ player.score.toLocaleString() }}점</span>
      </li>
    </ul>
    <div v-else class="no-data">
      어제자 랭킹이 없습니다.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const rankings = ref([]);
const isLoading = ref(true);

const fetchRankings = async () => {
  try {
    // 한국 시간 기준 어제 날짜 계산
    const kstOffset = 9 * 60 * 60 * 1000;
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000 + kstOffset);
    const yesterdayId = yesterday.toISOString().slice(0, 10);

    const q = query(
      collection(db, `leaderboards/salt_guardians_daily/${yesterdayId}`),
      orderBy("score", "desc"),
      limit(7)
    );
    const snapshot = await getDocs(q);
    rankings.value = snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("솔트 가디언즈 랭킹 로딩 오류:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchRankings);
</script>

<style scoped>
/* (기존 LeaderboardWidget.vue와 유사한 스타일) */
.ranking-widget { display: flex; flex-direction: column; }
.ranking-widget h3 { margin-bottom: 15px; }
.ranking-widget .card-icon { color: #3498db; }
.loading-state, .no-data { flex-grow: 1; display: flex; justify-content: center; align-items: center; font-style: italic; color: #666; }
.spinner-small { border: 3px solid rgba(0, 0, 0, 0.1); border-top-color: #3498db; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ranking-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.ranking-list li { display: flex; align-items: center; padding: 8px; border-radius: 6px; }
.rank-badge { width: 30px; font-weight: bold; text-align: center; margin-right: 10px; }
.player-name { flex-grow: 1; }
.player-score { font-weight: bold; }
.rank-1 { background-color: rgba(255, 215, 0, 0.2); }
.rank-1 .rank-badge { color: #ffd700; }
.rank-2 { background-color: rgba(192, 192, 192, 0.2); }
.rank-3 { background-color: rgba(205, 127, 50, 0.2); }
</style>