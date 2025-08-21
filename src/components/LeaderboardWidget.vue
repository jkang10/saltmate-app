<template>
  <div class="feature-card leaderboard">
    <div class="card-icon"><i class="fas fa-crown"></i></div>
    <h3>오늘의 TOP 5</h3>
    <ol class="leaderboard-list">
      <li
        v-for="(winner, index) in winners"
        :key="winner.id"
        class="leaderboard-item"
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
  const q = query(
    collection(db, `leaderboards/daily_winners/${today}`),
    orderBy("totalWinnings", "desc"),
    limit(5),
  );

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
  padding: 8px 0;
  font-size: 1em;
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
</style>
