<template>
  <div class="leaderboard-widget card">
    <div class="card-icon"><i class="fas fa-trophy"></i></div>
    <h3> 주간 TOP 7</h3>
    <div v-if="isLoading" class="loading-state">
      <div class="spinner-small"></div>
    </div>
    <div v-else-if="error" class="error-state">
      <small>{{ error }}</small>
    </div>
    <ol v-else-if="winners.length > 0" class="winner-list">
      <li
        v-for="(winner, index) in winners"
        :key="winner.userId"
        :class="{ 'top-rank': index < 3, 'first-rank-item': index === 0 }"
      >
        <span class="rank">{{ index + 1 }}</span>
        <span class="name">{{ winner.userName }}</span>
        <span class="score"
          >{{
            Math.floor(winner.totalWinnings).toLocaleString()
          }}
          SaltMate</span
        >
      </li>
    </ol>
    <div v-else class="empty-state">
      <small>지난 주 랭킹 데이터가 없습니다.</small>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { db } from "@/firebaseConfig";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const winners = ref([]);
const isLoading = ref(true);
const error = ref(null);

const fetchWeeklyWinners = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();

    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);

    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    
    const weekId = lastMonday.toISOString().slice(0, 10);

    console.log("Fetching weekly winners for weekId:", weekId);

    const q = query(
      collection(db, `leaderboards/weekly_winners/${weekId}`),
      orderBy("rank", "asc"),
      limit(7),
    );
    const querySnapshot = await getDocs(q);
    winners.value = querySnapshot.docs.map((doc) => doc.data());
  } catch (e) {
    console.error("주간 랭킹 조회 오류:", e);
    error.value = "랭킹을 불러오지 못했습니다.";
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchWeeklyWinners);
</script>

<style scoped>
.leaderboard-widget.card {
  padding: 15px 20px;
  background: linear-gradient(
    135deg,
    #535c82 0%,
    #3f466b 100%
  );
  border: none;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  height: 470px; /* 고정된 높이 */
  color: #ecf0f1;
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
  /* [추가] 내부 콘텐츠를 세로 중앙 정렬하기 위한 속성 */
  justify-content: center; /* 자식 요소들을 세로 중앙으로 정렬 */
}

/* [수정] 마우스 호버 시 카드에 효과 적용 */
.leaderboard-widget.card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}

.leaderboard-widget::before {
  content: '';
  position: absolute;
  top: -100%;
  left: -100%;
  width: 300%;
  height: 300%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 20%, rgba(255, 255, 255, 0) 50%);
  animation: rotateLight 25s linear infinite;
  z-index: 0;
  opacity: 0.7;
}

/* [수정] @keyframes 앞에 마침표(.)가 없어야 합니다. */
@keyframes rotateLight {
  0% { transform: rotate(0deg) scale(0.8); opacity: 0.5; }
  50% { transform: rotate(180deg) scale(1.1); opacity: 1; }
  100% { transform: rotate(360deg) scale(0.8); opacity: 0.5; }
}

/* 이하 기존 스타일 유지 */
h3, .winner-list, .loading-state, .error-state, .empty-state {
  position: relative;
  z-index: 1;
}

h3 {
  font-size: 1.2em;
  margin: 0 0 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  text-shadow: 1px 1px 3px rgba(0,0,0,0.4);
}

h3 .fa-trophy {
  color: #ffc107;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  color: #bdc3c7;
  font-size: 0.9em;
  /* [수정] 아래 4줄 추가 */
  display: flex;
  flex-direction: column; /* 컨텐츠를 세로로 쌓기 위함 */
  justify-content: center; /* 세로 중앙 정렬 */
  align-items: center; /* 가로 중앙 정렬 */
  flex-grow: 1; /* 남은 공간을 모두 차지하여 중앙 정렬의 기준점으로 삼음 */
}

.spinner-small {
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.winner-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-grow: 1; /* [추가] 부모의 남은 공간을 모두 차지하도록 설정 */
  justify-content: center; /* [추가] 내부 리스트 아이템들을 세로 중앙으로 정렬 */
}

.winner-list li {
  display: flex;
  align-items: center;
  font-size: 0.95em;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.winner-list li:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: translateX(3px);
}

.winner-list li.first-rank-item {
  background: linear-gradient(90deg, #ff8a80 0%, #ffd180 100%);
  color: #333;
  font-weight: bold;
}

.winner-list li.first-rank-item .rank,
.winner-list li.first-rank-item .name,
.winner-list li.first-rank-item .score {
  color: #333;
}

.rank {
  width: 25px;
  font-weight: bold;
  text-align: center;
}

.name {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score {
  font-weight: bold;
}
</style>