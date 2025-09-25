<template>
  <div class="page-container">
    <h1>소금 상인</h1>
    <div v-if="market" class="market-info">
      <p>현재 소금 시세: <strong>1개 = {{ market.currentPrice }} SaltMate</strong></p>
      </div>
    <div class="trade-form">
      <input type="number" v-model="quantity" min="1">
      <button @click="trade('buy')">소금 사기</button>
      <button @click="trade('sell')">소금 팔기</button>
    </div>
     <p v-if="error">{{ error }}</p>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { db, functions } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const market = ref(null);
const quantity = ref(1);
const error = ref('');
let unsubscribe = null;

onMounted(() => {
  const marketRef = doc(db, "configuration", "saltMarket");
  unsubscribe = onSnapshot(marketRef, (docSnap) => {
    if (docSnap.exists()) market.value = docSnap.data();
  });
});

onUnmounted(() => { if(unsubscribe) unsubscribe(); });

const trade = async (action) => {
  error.value = '';
  try {
    const tradeSalt = httpsCallable(functions, 'tradeSalt');
    await tradeSalt({ action: action, quantity: quantity.value });
    alert('거래 성공!');
  } catch(e) {
    error.value = e.message;
  }
};
</script>