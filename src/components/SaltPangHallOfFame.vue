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
@keyframes spin { to { transform: rotate(360deg); } }

.ranking-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-grow: 1;
  justify-content: center;
}
.ranking-list li {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.05);
  font-size: 1.1em;
  position: relative; /* [추가] 슈도 엘리먼트 위치 지정을 위함 */
  overflow: hidden; /* [추가] 반짝이 효과가 바깥으로 나가지 않도록 */
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
  /* [수정] 기본 글 색상 흰색 */
  color: #fff; 
}
.player-score {
  font-weight: bold;
  /* [수정] 기본 글 색상 흰색 */
  color: #fff;
}

/* 1위 유저를 위한 화려한 이펙트 */
.rank-1 {
  background: linear-gradient(-45deg, #f1c40f, #e67e22, #f39c12, #f1c40f);
  background-size: 400% 400%;
  animation: gradient-animation 5s ease infinite;
  color: #2c3e50;
  font-weight: bold;
  border: 2px solid #fff;
  box-shadow: 0 0 15px #f1c40f;
}
/* [신규 추가] 1위 반짝이 애니메이션 */
.rank-1::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 0;
  height: 200%;
  background: rgba(255, 255, 255, 0.4); /* 반짝이 색상 */
  transform: rotate(45deg);
  animation: shine-animation 3s infinite linear;
}

.rank-1 .rank-badge {
  color: #fff;
  text-shadow: 0 0 5px #000;
  animation: crown-glow 2s infinite alternate;
}
/* [수정] 1위일 경우 글 색상 다시 어둡게 (배경이 밝으니까) */
.rank-1 .player-name,
.rank-1 .player-score {
  color: #2c3e50; 
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
/* [신규 추가] 반짝이 애니메이션 키프레임 */
@keyframes shine-animation {
  0% {
    left: -50%;
    width: 0;
  }
  50% {
    left: 100%;
    width: 100%;
  }
  100% {
    left: 100%;
    width: 0;
  }
}
</style>