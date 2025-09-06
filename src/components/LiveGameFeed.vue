<template>
  <div class="feature-card feed">
    <div class="card-icon"><i class="fas fa-satellite-dish"></i></div>
    <h3>실시간 당첨 피드</h3>
    <ul class="feed-list">
      <li v-for="item in feedItems" :key="item.id" class="feed-item">
        <i class="fas fa-trophy"></i>
        <span
          ><strong>{{ item.userName }}</strong
          >님께서 {{ item.description }}으로
          <strong>{{ item.prize.toLocaleString() }} SaltMate</strong>를
          획득했습니다!</span
        >
      </li>
    </ul>
    <span v-if="feedItems.length === 0" class="no-feed"
      >최근 당첨 내역이 없습니다.</span
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

const feedItems = ref([]);
let unsubscribe = null;

onMounted(() => {
  const q = query(
    collection(db, "game_feed"),
    orderBy("timestamp", "desc"),
    limit(5),
  );
  unsubscribe = onSnapshot(q, (querySnapshot) => {
    const items = [];
    querySnapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    feedItems.value = items;
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.feature-card.feed {
  background: #fff;
  text-align: left;
}
.card-icon {
  color: #20c997;
}
.feed-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.feed-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f1f1f1;
  font-size: 0.9em;
  color: #555;
}
.feed-item:last-child {
  border-bottom: none;
}
.feed-item i {
  color: #ffc107;
}
.no-feed {
  color: #888;
  font-size: 0.9em;
}
</style>
