<template>
  <div class="page-container auction-page">
    <header class="page-header">
      <h1><i class="fas fa-gavel"></i> 주간 경매장</h1>
      <p>최고가에 도전하여 이번 주 특별 아이템을 획득하세요!</p>
    </header>

    <div v-if="auction.active" class="auction-card card">
      <div class="prize-section">
        <div class="prize-image">🎁</div>
        <div class="prize-details">
          <h2>{{ auction.active.prizeName }}</h2>
          <p>{{ auction.active.prizeDescription }}</p>
        </div>
      </div>

      <div class="timer-section">
        <h3>경매 마감까지</h3>
        <div class="countdown">{{ countdown }}</div>
      </div>

      <div class="bid-info">
        <div class="info-item">
          <small>현재 최고가</small>
          <strong>{{ (auction.active.highestBid || 0).toLocaleString() }} SaltMate</strong>
        </div>
        <div class="info-item">
          <small>최고 입찰자</small>
          <strong>{{ auction.active.highestBidderName || '없음' }}</strong>
        </div>
      </div>
      <form @submit.prevent="placeBid" class="bid-form">
        <input type="number" v-model="bidAmount" :placeholder="`${(auction.active.highestBid || 0) + 1} 이상 입찰`" min="1">
        <button type="submit" :disabled="isBidding || !isAuctionActive" class="btn-primary">
          <span v-if="isBidding" class="spinner-small"></span>
          <span v-else>{{ isAuctionActive ? '입찰하기' : '경매 마감' }}</span>
        </button>
      </form>
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>
     <div v-else class="card">
      <p>현재 진행 중인 경매가 없습니다. 다음 주 월요일을 기다려주세요.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { db, functions } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const auction = reactive({ active: null });
const bidAmount = ref(null);
const isBidding = ref(false);
const error = ref('');
const countdown = ref('00:00:00');
let unsubscribe = null;
let countdownInterval = null;

const getWeekId = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    return new Date(monday.getTime() + 9*60*60*1000).toISOString().slice(0,10);
};

const isAuctionActive = computed(() => {
    if (!auction.active?.endTime) return false;
    return auction.active.endTime.toDate() > new Date();
});

onMounted(() => {
  const weekId = getWeekId();
  const auctionRef = doc(db, "auctions", weekId);
  unsubscribe = onSnapshot(auctionRef, (docSnap) => {
    if (docSnap.exists()) {
      auction.active = docSnap.data();
      startCountdown();
    } else {
      auction.active = null;
    }
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
  if (countdownInterval) clearInterval(countdownInterval);
});

const startCountdown = () => {
    if(countdownInterval) clearInterval(countdownInterval);
    if (!auction.active?.endTime) return;

    countdownInterval = setInterval(() => {
        const now = new Date();
        const end = auction.active.endTime.toDate();
        const diff = end.getTime() - now.getTime();

        if (diff <= 0) {
            countdown.value = '경매 종료';
            clearInterval(countdownInterval);
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        countdown.value = `${d}일 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);
}

const placeBid = async () => {
  if (!bidAmount.value) return;
  isBidding.value = true;
  error.value = '';
  try {
    const placeAuctionBid = httpsCallable(functions, 'placeAuctionBid');
    await placeAuctionBid({ weekId: getWeekId(), bidAmount: bidAmount.value });
    bidAmount.value = null;
    alert('입찰에 성공했습니다!');
  } catch(e) {
    error.value = e.message;
  } finally {
    isBidding.value = false;
  }
};
</script>

<style scoped>
.auction-page { text-align: center; }
.card { background: white; border-radius: 16px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); }
.prize-section { display: flex; align-items: center; gap: 20px; text-align: left; }
.prize-image { font-size: 4em; }
.prize-details h2 { margin: 0 0 5px; font-size: 1.5em; }
.prize-details p { margin: 0; color: #555; }
.timer-section { margin: 25px 0; background: #f8f9fa; padding: 15px; border-radius: 12px; }
.timer-section h3 { margin: 0 0 10px; font-size: 1em; color: #666; }
.countdown { font-size: 2em; font-weight: bold; color: #007bff; font-family: monospace; }
.bid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
.info-item { background: #f8f9fa; padding: 15px; border-radius: 12px; }
.info-item small { display: block; margin-bottom: 5px; color: #666; }
.info-item strong { font-size: 1.2em; }
.bid-form { display: flex; gap: 10px; }
.bid-form input { flex-grow: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1em; }
</style>