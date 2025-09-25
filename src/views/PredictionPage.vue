<template>
  <div class="page-container">
    <h1>솔트팡 랭킹 예측</h1>
    <p>이번 주 솔트팡 랭킹전 TOP 3를 예측하고 베팅하세요!</p>
    <div v-if="market.status === 'open'" class="betting-form">
      <input v-model="predictions['1st']" placeholder="1위 예상 유저 UID">
      <input v-model="predictions['2nd']" placeholder="2위 예상 유저 UID">
      <input v-model="predictions['3rd']" placeholder="3위 예상 유저 UID">
      <input type="number" v-model="betAmount" placeholder="베팅 금액">
      <button @click="placeBet" :disabled="isBetting">베팅하기</button>
    </div>
    <div v-else>
      <p>이번 주 베팅이 마감되었습니다.</p>
    </div>
    <p v-if="error">{{ error }}</p>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted } from 'vue';
import { functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';

const market = reactive({ status: 'closed' });
const predictions = reactive({ '1st': '', '2nd': '', '3rd': '' });
const betAmount = ref(100);
const isBetting = ref(false);
const error = ref('');

const getWeekId = () => { /* ... (AuctionPage와 동일) ... */ };

const placeBet = async () => {
  isBetting.value = true;
  error.value = '';
  try {
    const placePredictionBet = httpsCallable(functions, 'placePredictionBet');
    await placePredictionBet({
      weekId: getWeekId(),
      betAmount: betAmount.value,
      predictions: predictions
    });
    alert('베팅 성공!');
  } catch(e) {
    error.value = e.message;
  } finally {
    isBetting.value = false;
  }
};
</script>