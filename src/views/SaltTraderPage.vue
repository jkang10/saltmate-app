<template>
  <div class="page-container trader-page">
    <header class="page-header">
      <h1><i class="fas fa-exchange-alt"></i> 소금 상인</h1>
      <p>변동하는 시세에 맞춰 소금을 사고팔아 수익을 내보세요.</p>
    </header>

    <div class="card trader-card">
      <div class="market-info">
        <h3>현재 소금 시세</h3>
        <p class="current-price" :class="priceClass">{{ (market?.currentPrice || 0).toLocaleString() }} SaltMate</p>
      </div>

      <div class="chart-container">
        <v-chart class="chart" :option="chartOption" autoresize />
      </div>

      <div class="my-assets">
        <div class="asset-item">
            <i class="fas fa-gifts"></i>
            <span>내 SaltMate</span>
            <strong>{{ (userProfile?.saltmatePoints || 0).toLocaleString() }}</strong>
        </div>
        <div class="asset-item">
            <i class="fas fa-gem"></i>
            <span>보유 소금</span>
            <strong>{{ (userProfile?.saltBalance || 0).toLocaleString() }}</strong>
        </div>
      </div>

      <div class="trade-form">
        <div class="trade-section">
          <h4>소금 사기</h4>
          <input type="number" v-model.number="buyQuantity" min="1" placeholder="구매 수량">
          <p class="trade-summary">예상 비용: {{ (buyQuantity * (market?.currentPrice || 0)).toLocaleString() }} SP</p>
          <button @click="trade('buy')" class="btn-primary btn-buy" :disabled="isTrading">
            <span v-if="isTrading" class="spinner-small"></span>
            <span v-else>매수</span>
          </button>
        </div>
        <div class="trade-section">
            <h4>소금 팔기</h4>
          <input type="number" v-model.number="sellQuantity" min="1" placeholder="판매 수량">
          <p class="trade-summary">예상 수익: {{ (sellQuantity * (market?.currentPrice || 0)).toLocaleString() }} SP</p>
          <button @click="trade('sell')" class="btn-primary btn-sell" :disabled="isTrading">
            <span v-if="isTrading" class="spinner-small"></span>
            <span v-else>매도</span>
          </button>
        </div>
      </div>
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { db, functions, auth } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent } from 'echarts/components';
import VChart from 'vue-echarts';

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, GridComponent]);

const market = ref({ currentPrice: 0, priceHistory: [] });
const userProfile = ref(null);
const buyQuantity = ref(1);
const sellQuantity = ref(1);
const error = ref('');
const isTrading = ref(false);
const priceClass = ref('');
let marketUnsubscribe = null;
let userUnsubscribe = null;

watch(() => market.value?.currentPrice, (newPrice, oldPrice) => {
    if (newPrice > oldPrice) {
        priceClass.value = 'up';
    } else if (newPrice < oldPrice) {
        priceClass.value = 'down';
    }
    setTimeout(() => priceClass.value = '', 500);
});

const chartOption = computed(() => {
    const history = market.value?.priceHistory || [];
    return {
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        tooltip: { trigger: 'axis' },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: history.map(h => new Date(h.time.seconds * 1000).toLocaleTimeString('ko-KR')),
        },
        yAxis: { type: 'value' },
        series: [{
            data: history.map(h => h.price),
            type: 'line',
            smooth: true,
            areaStyle: {}
        }]
    };
});

onMounted(() => {
  const marketRef = doc(db, "configuration", "saltMarket");
  marketUnsubscribe = onSnapshot(marketRef, (docSnap) => {
      if (docSnap.exists()) market.value = docSnap.data();
  });

  if(auth.currentUser) {
    const userRef = doc(db, "users", auth.currentUser.uid);
    userUnsubscribe = onSnapshot(userRef, (docSnap) => {
        if(docSnap.exists()) userProfile.value = docSnap.data();
    });
  }
});

onUnmounted(() => {
    if(marketUnsubscribe) marketUnsubscribe();
    if(userUnsubscribe) userUnsubscribe();
});

const trade = async (action) => {
  error.value = '';
  isTrading.value = true;
  const quantity = action === 'buy' ? buyQuantity.value : sellQuantity.value;
  try {
    const tradeSalt = httpsCallable(functions, 'tradeSalt');
    await tradeSalt({ action: action, quantity: quantity });
    alert('거래 성공!');
  } catch(e) {
    error.value = e.message;
  } finally {
      isTrading.value = false;
  }
};
</script>

<style scoped>
.trader-page { text-align: center; }
.trader-card { max-width: 700px; margin: 0 auto; }
.current-price { font-size: 2.5em; font-weight: bold; transition: color 0.3s; }
.current-price.up { color: #28a745; }
.current-price.down { color: #dc3545; }
.chart-container { height: 300px; margin: 20px 0; }
.my-assets { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
.asset-item { display: flex; flex-direction: column; }
.asset-item span { color: #555; }
.asset-item strong { font-size: 1.5em; }
.trade-form { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.trade-section { display: flex; flex-direction: column; gap: 10px; padding: 20px; border: 1px solid #eee; border-radius: 12px; }
.trade-summary { font-size: 0.9em; color: #666; }
.btn-buy { background-color: #007bff; }
.btn-sell { background-color: #28a745; }
</style>