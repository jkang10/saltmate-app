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
        <div class="asset-item" @click="openHistoryModal" style="cursor: pointer;" title="클릭하여 구매 내역 확인">
            <i class="fas fa-gem"></i>
            <span>보유 소금</span>
            <strong>{{ (userProfile?.saltBalance || 0).toLocaleString() }}</strong>
        </div>
      </div>

      <div class="trade-form">
        <div class="trade-section">
          <h4>소금 사기</h4>
          <input type="number" v-model.number="buyQuantity" min="1" placeholder="구매 수량">
          <p class="trade-summary">예상 비용: {{ (buyQuantity * (market?.currentPrice || 0)).toLocaleString() }} SaltMate</p>
          <button @click="trade('buy')" class="btn-primary btn-buy" :disabled="isTrading">
            <span v-if="isTrading" class="spinner-small"></span>
            <span v-else>매수</span>
          </button>
        </div>
        <div class="trade-section">
            <h4>소금 팔기</h4>
          <input type="number" v-model.number="sellQuantity" min="1" placeholder="판매 수량">
          <p class="trade-summary">예상 수익: {{ (sellQuantity * (market?.currentPrice || 0)).toLocaleString() }} SaltMate</p>
          <button @click="trade('sell')" class="btn-primary btn-sell" :disabled="isTrading">
            <span v-if="isTrading" class="spinner-small"></span>
            <span v-else>매도</span>
          </button>
        </div>
      </div>
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>

    <div v-if="isHistoryModalVisible" class="modal-overlay" @click.self="isHistoryModalVisible = false">
      <div class="modal-content">
        <h3>소금 거래 내역</h3>
        <div v-if="isLoadingHistory" class="spinner-small"></div>
        <ul v-else-if="tradeHistory.length > 0" class="trade-history-list">
          <li v-for="item in tradeHistory" :key="item.id">
            <span class="history-date">{{ new Date(item.timestamp.seconds * 1000).toLocaleString('ko-KR') }}</span>
            <span class="history-action" :class="item.action">{{ item.action === 'buy' ? '매수' : '매도' }}</span>
            <span class="history-details">{{ item.quantity }}개 ({{ item.price }}/개)</span>
          </li>
        </ul>
        <p v-else>거래 내역이 없습니다.</p>
        <button @click="isHistoryModalVisible = false" class="btn-secondary">닫기</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { db, functions, auth } from '@/firebaseConfig';
import { doc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent } from 'echarts/components';
import VChart from 'vue-echarts';

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, GridComponent]);

const isHistoryModalVisible = ref(false);
const tradeHistory = ref([]);
const isLoadingHistory = ref(false);
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

const openHistoryModal = async () => {
  isHistoryModalVisible.value = true;
  isLoadingHistory.value = true;
  try {
    if (!auth.currentUser) return;
    const historyRef = collection(db, `users/${auth.currentUser.uid}/saltTradeHistory`);
    const q = query(historyRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    tradeHistory.value = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  } catch (e) {
    console.error("거래 내역 조회 오류:", e);
  } finally {
    isLoadingHistory.value = false;
  }
};
</script>

<style scoped>
.page-container { max-width: 800px; margin: 90px auto 20px; padding: 20px; }
.page-header { text-align: center; margin-bottom: 20px; }
.trader-page { text-align: center; }
.trader-card { max-width: 700px; margin: 0 auto; background: white; border-radius: 16px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); }
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
.btn-primary { padding: 10px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; }
.btn-buy { background-color: #007bff; color: white; }
.btn-sell { background-color: #28a745; color: white; }
.btn-primary:disabled { background-color: #aaa; }
.error-message { color: #dc3545; margin-top: 15px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 500px; }
.trade-history-list { list-style: none; padding: 0; max-height: 400px; overflow-y: auto; }
.trade-history-list li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
.history-action.buy { color: #007bff; font-weight: bold; }
.history-action.sell { color: #28a745; font-weight: bold; }
.btn-secondary { background-color: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; margin-top: 20px; }

@media (max-width: 768px) {
  .trade-form {
    grid-template-columns: 1fr;
  }
  .my-assets {
    grid-template-columns: 1fr;
  }
}
</style>