<template>
  <div v-if="announcement" class="ticker-wrap">
    <div class="ticker">
      <div class="ticker-item">
        <i class="fas fa-bullhorn"></i>
        <a v-if="announcement.link" :href="announcement.link" target="_blank" rel="noopener noreferrer">
          {{ announcement.message }}
        </a>
        <span v-else>{{ announcement.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

const announcement = ref(null);
let unsubscribe = null;

onMounted(() => {
  const q = query(
    collection(db, 'announcements'),
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      announcement.value = snapshot.docs[0].data();
    } else {
      announcement.value = null;
    }
  });
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});
</script>

<style scoped>
@keyframes ticker {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

.ticker-wrap {
  position: fixed;
  top: 56px; /* Navbar height */
  left: 0;
  width: 100%;
  overflow: hidden;
  background: linear-gradient(90deg, #1e3c72, #2a5298);
  color: white;
  padding: 10px 0;
  z-index: 999;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.ticker {
  display: inline-block;
  white-space: nowrap;
  animation: ticker 20s linear infinite;
}

.ticker-item {
  display: inline-block;
  padding: 0 2rem;
  font-size: 1.1em;
  font-weight: 500;
}

.ticker-item i {
  margin-right: 12px;
  color: #ffd700;
}

.ticker-item a {
  color: white;
  text-decoration: underline;
}
</style>
