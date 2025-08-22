<template>
  <div class="feature-card leaderboard">
    <div class="card-icon"><i class="fas fa-crown"></i></div>
    <h3>오늘의 TOP 7</h3>
    <ol class="leaderboard-list">
      <li
        v-for="(winner, index) in winners"
        :key="winner.id"
        class="leaderboard-item"
        :class="{ 'rank-1': index === 0 }"
      >
        <span class="rank">{{ index + 1 }}</span>
        <span class="name">{{ winner.userName }}</span>
        <span class="score"
          >{{ winner.totalWinnings.toLocaleString() }} SaltMate</span
        >
      </li>
    </ol>
    <span v-if="winners.length === 0" class="no-feed"
      >오늘의 랭킹이 아직 없습니다.</span
    >
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

const winners = ref([]);
let unsubscribe = null;

onMounted(() => {
  const today = new Date().toISOString().slice(0, 10);
  // ▼▼▼ [수정] limit(5)를 limit(7)로 변경하여 7위까지 불러옵니다. ▼▼▼
  const q = query(
    collection(db, `leaderboards/daily_winners/${today}`),
    orderBy("totalWinnings", "desc"),
    limit(7),
  );
  // ▲▲▲ 수정 완료 ▲▲▲

  unsubscribe = onSnapshot(q, (querySnapshot) => {
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    winners.value = items;
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.feature-card.leaderboard {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  overflow: hidden;
}
.card-icon {
  color: #ffd700;
}
h3 {
  color: white;
}
.leaderboard-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.leaderboard-item {
  display: flex;
  align-items: center;
  padding: 10px 15px;
  font-size: 1em;
  border-radius: 8px;
  transition: all 0.3s ease;
  margin: 5px 0;
}
.rank {
  font-weight: bold;
  width: 30px;
}
.name {
  flex-grow: 1;
}
.score {
  font-weight: bold;
}
.no-feed {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9em;
}

.leaderboard-item.rank-1 {
  background-size: 400% 400%;
  animation:
    rainbow-glow 5s ease infinite,
    float-effect 3s ease-in-out infinite;
  background-image: linear-gradient(-45deg, #ffd700, #fca5f1, #b3c7f0, #a6e3e9);
  color: #333;
  font-weight: bold;
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
}

@keyframes rainbow-glow {
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

@keyframes float-effect {
  0% {
    transform: translatey(0px) scale(1.05);
  }
  50% {
    transform: translatey(-5px) scale(1.05);
  }
  100% {
    transform: translatey(0px) scale(1.05);
  }
}
</style>
