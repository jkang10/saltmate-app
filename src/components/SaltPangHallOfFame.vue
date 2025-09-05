<template>
  <div class="hall-of-fame-widget feature-card">
    <div class="widget-header">
      <div class="card-icon"><i class="fas fa-trophy"></i></div>
      <h3>솔트팡 명예의 전당</h3>
    </div>
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-small"></div>
    </div>
    <ul v-else-if="rankings.length > 0" class="ranking-list">
      <li
        v-for="(player, index) in rankings"
        :key="player.uid"
        :class="['rank-' + (index + 1)]"
      >
        <div class="rank-badge">
          <i v-if="index === 0" class="fas fa-crown"></i>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <span class="player-name">{{ player.username }}</span>
        <span class="player-score">{{ player.score.toLocaleString() }}점</span>
      </li>
    </ul>
    <div v-else class="no-data">
      아직 랭킹 데이터가 없습니다.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getFunctions, httpsCallable } from 'firebase/functions';

const rankings = ref([]);
const isLoading = ref(true);

const fetchHallOfFame = async () => {
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const getSaltPangHallOfFame = httpsCallable(functions, 'getSaltPangHallOfFame');
    const result = await getSaltPangHallOfFame();
    rankings.value = result.data.rankings;
  } catch (error) {
    console.error("명예의 전당 로딩 오류:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchHallOfFame);
</script>

<style scoped>
/* [수정] .hall-of-fame-widget 클래스에 important 키워드를 제거하고 스타일 재정의 */
.hall-of-fame-widget {
  background: #2c3e50 !important; /* 어두운 배경색 강제 적용 */
  color: #ecf0f1;
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.widget-header {
  display: flex;
  align-items: center;
  gap: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 15px;
  margin-bottom: 15px;
}
.widget-header .card-icon {
  font-size: 1.8em;
  color: #f1c40f;
}
.widget-header h3 {
  font-size: 1.4em;
  margin: 0;
  color: #fff;
}
.loading-state, .no-data {
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  font-style: italic;
  color: #bdc3c7;
}
.spinner-small {
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(3deg); } }

.ranking-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-grow: 1; /* [추가] 남은 공간을 채우도록 */
  justify-content: center; /* [추가] 세로 중앙 정렬 */
}
.ranking-list li {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.05);
  font-size: 1.1em;
}
.rank-badge {
  width: 35px;
  font-weight: bold;
  font-size: 1.2em;
  text-align: center;
  margin-right: 15px;
}
.player-name {
  flex-grow: 1;
}
.player-score {
  font-weight: bold;
}

.rank-1 {
  background: linear-gradient(-45deg, #f1c40f, #e67e22, #f39c12, #f1c40f);
  background-size: 400% 400%;
  animation: gradient-animation 5s ease infinite;
  color: #2c3e50;
  font-weight: bold;
  border: 2px solid #fff;
  box-shadow: 0 0 15px #f1c40f;
}
.rank-1 .rank-badge {
  color: #fff;
  text-shadow: 0 0 5px #000;
  animation: crown-glow 2s infinite alternate;
}
.rank-2 {
  background-color: rgba(192, 192, 192, 0.2);
}
.rank-3 {
  background-color: rgba(205, 127, 50, 0.2);
}

@keyframes gradient-animation {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes crown-glow {
  from { transform: scale(1); }
  to { transform: scale(1.2); }
}
</style>