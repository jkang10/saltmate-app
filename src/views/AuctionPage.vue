<template>
  <div class="page-container">
    <h1>주간 경매장</h1>
    <div v-if="auction.active" class="auction-card">
      <h2>{{ auction.active.prizeName }}</h2>
      <p>{{ auction.active.prizeDescription }}</p>
      <div class="bid-info">
        <div>
          <small>현재 최고가</small>
          <strong>{{ auction.active.highestBid.toLocaleString() }} SP</strong>
        </div>
        <div>
          <small>최고 입찰자</small>
          <strong>{{ auction.active.highestBidderName || '없음' }}</strong>
        </div>
      </div>
      <form @submit.prevent="placeBid">
        <input type="number" v-model="bidAmount" :placeholder="`현재가보다 높은 금액`" min="1">
        <button type="submit" :disabled="isBidding">입찰하기</button>
      </form>
    </div>
    <p v-if="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { db, functions } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const auction = reactive({ active: null });
const bidAmount = ref(0);
const isBidding = ref(false);
const error = ref('');
let unsubscribe = null;

const getWeekId = () => new Date(new Date().getTime() + 9*60*60*1000).toISOString().slice(0,10);

onMounted(() => {
  const weekId = getWeekId();
  const auctionRef = doc(db, "auctions", weekId);
  unsubscribe = onSnapshot(auctionRef, (docSnap) => {
    if (docSnap.exists()) auction.active = docSnap.data();
  });
});

onUnmounted(() => { if(unsubscribe) unsubscribe(); });

const placeBid = async () => {
  isBidding.value = true;
  error.value = '';
  try {
    const placeAuctionBid = httpsCallable(functions, 'placeAuctionBid');
    await placeAuctionBid({ weekId: getWeekId(), bidAmount: bidAmount.value });
    bidAmount.value = 0;
  } catch(e) {
    error.value = e.message;
  } finally {
    isBidding.value = false;
  }
};
</script>