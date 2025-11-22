<template>
  <div v-if="announcement" class="ticker-wrap" :class="{ 'ticker-fixed-top': isHeaderHidden }">
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
const isHeaderHidden = ref(false);
let unsubscribe = null;
let lastScrollY = 0;

// 스크롤 감지 핸들러
const handleScroll = () => {
  const currentScrollY = window.scrollY || document.documentElement.scrollTop;
  
  // 스크롤을 60px 이상 내렸을 때 헤더가 숨겨진다고 가정하고 공지바를 올림
  if (currentScrollY > 60 && currentScrollY > lastScrollY) {
    isHeaderHidden.value = true;
  } else {
    // 스크롤을 조금이라도 올리면 헤더가 나오므로 공지바도 내림
    isHeaderHidden.value = false;
  }
  
  lastScrollY = currentScrollY;
};

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

  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
  window.removeEventListener('scroll', handleScroll);
});
</script>

<style scoped>
@keyframes ticker {
  0% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
}

.ticker-wrap {
  position: fixed;
  /* 기본 위치: 헤더(56px) 아래 */
  top: 56px; 
  left: 0;
  width: 100%;
  overflow: hidden;
  background: linear-gradient(90deg, #1e3c72, #2a5298);
  color: white;
  padding: 10px 0;
  z-index: 999;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  transition: top 0.3s ease-in-out; /* 부드러운 이동 효과 */
}

/* 모바일 화면 (768px 이하) */
@media (max-width: 768px) {
  .ticker-wrap {
    /* 모바일 헤더 높이(46px)에 맞춤 */
    top: 46px; 
  }
}

/* 헤더가 숨겨졌을 때 (상단 고정) */
.ticker-fixed-top {
  top: 0 !important;
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