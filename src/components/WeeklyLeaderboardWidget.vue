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
  height: 470px;
  color: #ecf0f1;
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
  /* [수정] 상단 여백 추가로 위치 조정 */
  margin-top: 20px; /* 이 값을 조절하여 위치를 맞춥니다. */
}

/* [수정] 대시보드 솔트메이트처럼 더 생동감 있는 배경 반짝임 */
.leaderboard-widget::before {
  content: '';
  position: absolute;
  top: -100%; /* 더 넓은 범위에서 시작 */
  left: -100%; /* 더 넓은 범위에서 시작 */
  width: 300%; /* 크기 더 키움 */
  height: 300%; /* 크기 더 키움 */
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 20%, rgba(255, 255, 255, 0) 50%); /* 빛나는 그라데이션 수정 */
  animation: rotateLight 25s linear infinite; /* 애니메이션 속도 및 이름 변경 */
  z-index: 0;
  opacity: 0.7; /* 투명도 조절 */
}

/* [수정] 배경 애니메이션 키프레임 변경 */
@keyframes rotateLight {
  0% { transform: rotate(0deg) scale(0.8); opacity: 0.5; } /* 시작 시 작게, 흐리게 */
  50% { transform: rotate(180deg) scale(1.1); opacity: 1; } /* 중간에 크게, 밝게 */
  100% { transform: rotate(360deg) scale(0.8); opacity: 0.5; } /* 끝에 다시 작게, 흐리게 */
}


/* 기존 호버 효과 */
.leaderboard-widget.card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
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