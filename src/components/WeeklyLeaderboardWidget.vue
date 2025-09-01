<template>
  <div class="leaderboard-widget card">
    <h3><i class="fas fa-trophy"></i> 주간 TOP 7</h3>
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
        :class="{ 'top-rank': index < 3 }"
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
    // 오늘이 월요일(1)이면 7일 전, 화요일(2)이면 8일 전 ... 일요일(0)이면 6일 전
    const diff = today.getDate() - dayOfWeek - (dayOfWeek === 0 ? -1 : 6);
    const lastMonday = new Date(today.setDate(diff));
    const weekId = lastMonday.toISOString().slice(0, 10);

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
.leaderboard-widget {
  padding: 15px 20px;
  background-color: #fff;
  border: 1px solid #e9ecef;
  display: flex; /* [수정] flexbox 레이아웃 적용 */
  flex-direction: column; /* [수정] 세로 정렬 */
  height: 100%; /* [수정] 부모 높이에 맞춤 */
}

h3 {
  font-size: 1.2em;
  margin: 0 0 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #333;
}

h3 .fa-trophy {
  color: #ffc107;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 20px 0;
  color: #888;
  font-size: 0.9em;
  flex-grow: 1; /* [수정] 남은 공간을 채워 길이를 맞춤 */
  display: flex; /* [수정] 내부 요소 정렬 */
  justify-content: center; /* [수정] 수직 중앙 정렬 */
  align-items: center; /* [수정] 수평 중앙 정렬 */
}

.spinner-small {
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
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
  gap: 12px; /* 아이템 간 간격 */
  flex-grow: 1; /* [수정] 남은 공간을 채워 길이를 맞춤 */
}

.winner-list li {
  display: flex;
  align-items: center;
  font-size: 0.95em;
}

.winner-list li.top-rank .rank {
  font-weight: bold;
  color: #007bff;
}

.rank {
  width: 25px;
  font-weight: bold;
  color: #666;
  text-align: center;
}

.name {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #555; /* [수정] 글씨 색상 */
}

.score {
  font-weight: bold;
  color: #333; /* [수정] 글씨 색상 */
}
</style>