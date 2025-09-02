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
        :class="{ 'first-rank-item': index === 0 }"
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
  padding: 25px 20px;
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
  height: 470px;
  color: #ecf0f1;
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
}

.leaderboard-widget.card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
}

/* [수정] 배경 반짝임 효과가 제목(h3) 뒤에 가려지지 않도록 z-index 추가 */
.leaderboard-widget::before {
  content: '';
  position: absolute;
  top: -100%;
  left: -100%;
  width: 300%;
  height: 300%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 20%, rgba(255, 255, 255, 0) 50%);
  animation: rotateLight 25s linear infinite;
  z-index: 1; /* 콘텐츠와 동일한 z-index 레벨로 설정 */
  opacity: 0.7;
}

@keyframes rotateLight {
  0% { transform: rotate(0deg) scale(0.8); opacity: 0.5; }
  50% { transform: rotate(180deg) scale(1.1); opacity: 1; }
  100% { transform: rotate(360deg) scale(0.8); opacity: 0.5; }
}


h3, .winner-list, .loading-state, .error-state, .empty-state {
  position: relative;
  /* [수정] z-index를 2로 상향 조정하여 배경 효과보다 위에 오도록 함 */
  z-index: 2;
}

h3 {
  font-size: 1.4em;
  margin: 0 0 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  text-shadow: 1px 1px 3px rgba(0,0,0,0.4);
}

h3 .fa-trophy {
  color: #ffc107;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
  text-align: center;
  color: #bdc3c7;
  font-size: 1em;
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
  font-size: 1em;
  padding: 10px 15px;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.winner-list li:hover {
    background-color: rgba(255, 255, 255, 0.15);
    transform: translateX(3px);
}

/* [수정] 1등 애니메이션 효과를 위한 스타일 추가 */
.winner-list li.first-rank-item {
  color: #212529;
  font-weight: bold;
  background-size: 200% 100%;
  background-image: linear-gradient(
    90deg,
    #f8d7da 0%,
    #fff3cd 50%,
    #f8d7da 100%
  );
  animation: animated-gradient 3s ease-in-out infinite;
}

/* [추가] 1등 애니메이션 키프레임 */
@keyframes animated-gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.winner-list li.first-rank-item .rank,
.winner-list li.first-rank-item .name,
.winner-list li.first-rank-item .score {
  color: #333;
}

.rank {
  width: 30px;
  font-weight: bold;
  text-align: center;
  font-size: 1.1em;
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