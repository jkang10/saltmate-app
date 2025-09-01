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
  background: linear-gradient(135deg, #535c82 0%, #3f466b 100%); /* 오늘의 TOP 7과 유사한 보라색 계열, 살짝 톤 다운 */
  border: none;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #ecf0f1;
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
  padding: 20px 0;
  color: #bdc3c7;
  font-size: 0.9em;
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
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
  flex-grow: 1;
}

.winner-list li {
  display: flex;
  align-items: center;
  font-size: 0.95em;
}

.winner-list li.top-rank {
  font-weight: bold;
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
</style>s