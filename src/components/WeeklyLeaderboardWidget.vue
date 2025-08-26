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
  try {
    const today = new Date();
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - today.getDay() - 6);
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
/* (기존 LeaderboardWidget.vue와 유사한 스타일) */
.leaderboard-widget {
  padding: 15px;
}
.leaderboard-widget h3 {
  margin-top: 0;
  text-align: center;
}
.winner-list {
  list-style: none;
  padding: 0;
}
li {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}
.rank {
  font-weight: bold;
  width: 30px;
}
.name {
  flex-grow: 1;
}
.score {
  font-weight: 500;
}
.top-rank .rank {
  color: #f39c12;
}
</style>
