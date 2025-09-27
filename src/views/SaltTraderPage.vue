<template>
  <div class="page-container trader-page">
    <header class="page-header">
      <h1><i class="fas fa-chart-line"></i> Salt Trader</h1>
      <p>실시간 시세를 확인하고 소금을 거래하여 차익을 남기세요.</p>
    </header>

    <div class="trader-layout">
      <aside class="left-panel">
        <div class="card asset-card">
          <h3><i class="fas fa-wallet"></i> 나의 자산</h3>
          <div class="asset-item">
            <span>내 SaltMate</span>
            <strong>{{ (userProfile?.saltmatePoints || 0).toLocaleString() }}</strong>
          </div>
          <div class="asset-item salt" @click="openHistoryModal" style="cursor: pointer;" title="클릭하여 거래 내역 확인">
            <span>보유 소금</span>
            <strong>{{ (userProfile?.saltBalance || 0).toLocaleString() }}</strong>
          </div>
        </div>

        <div class="card order-card">
          <h3><i class="fas fa-tasks"></i> 주문 실행</h3>
          <div class="trade-section">
            <h4>소금 사기 (매수)</h4>
            <div class="input-group">
              <input type="number" v-model.number="buyQuantity" min="1" placeholder="수량">
              <button @click="trade('buy')" class="btn-primary btn-buy" :disabled="isTrading || !buyQuantity || buyQuantity <= 0">매수</button>
            </div>
            <p class="trade-summary">예상 비용: {{ (buyQuantity * (market?.currentPrice || 0)).toLocaleString() }} SaltMate</p>
          </div>
          <div class="trade-section">
            <h4>소금 팔기 (매도)</h4>
            <div class="input-group">
              <input type="number" v-model.number="sellQuantity" min="1" placeholder="수량">
              <button @click="trade('sell')" class="btn-primary btn-sell" :disabled="isTrading || !sellQuantity || sellQuantity <= 0">매도</button>
            </div>
            <p class="trade-summary">예상 수익: {{ (sellQuantity * (market?.currentPrice || 0)).toLocaleString() }} SaltMate</p>
          </div>
           <p v-if="error" class="error-message">{{ error }}</p>
        </div>
      </aside>

      <main class="right-panel">
        <div class="card market-card">
            <div class="market-header">
                <h3><i class="fas fa-gem"></i> 소금(SALT) 시세 정보</h3>
                <div v-if="priceChange !== 0" class="price-change" :class="priceClass">
                    <i v-if="priceClass === 'up'" class="fas fa-caret-up"></i>
                    <i v-if="priceClass === 'down'" class="fas fa-caret-down"></i>
                    {{ priceChange.toFixed(2) }}%
                </div>
            </div>
          <div class="price-display">
            <p class="current-price" :class="priceClass">{{ (market?.currentPrice || 0).toLocaleString() }} SaltMate</p>
          </div>
          <div class="chart-container">
            <v-chart class="chart" :option="chartOption" autoresize />
          </div>
        </div>
      </main>
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

// [핵심 수정] 기본값을 1에서 null로 변경하여 입력 폼을 비웁니다.
const buyQuantity = ref(null);
const sellQuantity = ref(null);

const error = ref('');
const isTrading = ref(false);
const priceClass = ref('');
const priceChange = ref(0);
let marketUnsubscribe = null;
let userUnsubscribe = null;

watch(() => market.value?.currentPrice, (newPrice, oldPrice) => {
    if (oldPrice && oldPrice !== 0) {
      priceChange.value = ((newPrice - oldPrice) / oldPrice) * 100;
      if (newPrice > oldPrice) priceClass.value = 'up';
      else if (newPrice < oldPrice) priceClass.value = 'down';
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
            data: history.map(h => h.time?.seconds ? new Date(h.time.seconds * 1000).toLocaleTimeString('ko-KR') : ''),
        },
        yAxis: { type: 'value', scale: true },
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
    // 거래 성공 후 입력 필드 초기화
    if(action === 'buy') buyQuantity.value = null;
    else sellQuantity.value = null;
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
:root {
  --primary-blue: #007bff;
  --success-green: #28a745;
  --danger-red: #dc3545;
  --light-gray: #f8f9fa;
  --border-color: #dee2e6;
  --text-dark: #212529;
  --text-light: #6c757d;
}
.page-container { max-width: 1200px; margin: 90px auto 20px; padding: 20px; }
.page-header { text-align: center; margin-bottom: 30px; }
.page-header h1 { font-size: 2.5em; }
.page-header p { font-size: 1.1em; color: var(--text-light); }
.trader-layout { display: grid; grid-template-columns: 320px 1fr; gap: 24px; align-items: start; }
.card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
.left-panel, .right-panel { display: flex; flex-direction: column; gap: 24px; }
.asset-card h3, .order-card h3 { margin-top: 0; }
.asset-item { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; }
.asset-item:not(:last-child) { border-bottom: 1px solid var(--border-color); }
.asset-item span { font-weight: 500; color: var(--text-light); }
.asset-item strong { font-size: 1.5em; font-weight: 700; }
.asset-item.salt { cursor: pointer; transition: background-color 0.2s; border-radius: 8px; margin: 5px -15px 0; padding: 10px 15px; }
.asset-item.salt:hover { background-color: var(--light-gray); }
.order-card h3 { margin-bottom: 20px; }
.trade-section { padding-top: 20px; }
.trade-section:not(:first-of-type) { margin-top: 20px; border-top: 1px solid var(--border-color); }
.trade-section h4 { margin-top: 0; margin-bottom: 15px; font-size: 1.1em; }
/* [핵심 수정] 입력 폼과 버튼 스타일 추가 */
.input-group { display: flex; }
/* [핵심 수정] 입력 폼 스타일 개선 */
.input-group input { 
  flex-grow: 1; 
  border: 2px solid var(--border-color); /* 테두리 두께 추가 */
  padding: 10px; 
  border-radius: 6px 0 0 6px; 
  font-size: 1em; 
  -webkit-appearance: none;
  margin: 0;
  transition: border-color 0.2s;
}
.input-group input:focus {
  outline: none;
  border-color: var(--primary-blue);
}
.input-group button { border-radius: 0 6px 6px 0; }
.trade-summary { font-size: 0.9em; color: var(--text-light); margin-top: 8px; text-align: right; }
.market-card { padding: 0; overflow: hidden; }
.market-header { display: flex; justify-content: space-between; align-items: center; padding: 24px 24px 0; }
.price-change { font-weight: bold; padding: 5px 10px; border-radius: 6px; }
.price-change.up { color: var(--success-green); background-color: #eafaf1; }
.price-change.down { color: var(--danger-red); background-color: #ffe8e8; }
.current-price { font-size: 3em; font-weight: 700; padding: 0 24px; text-align: center; transition: color 0.3s; }
.current-price.up { color: var(--success-green); }
.current-price.down { color: var(--danger-red); }
.chart-container { height: 350px; }
.btn-primary { padding: 10px 15px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; color: white; transition: background-color 0.2s; }
.btn-buy { background-color: var(--primary-blue); }
.btn-sell { background-color: var(--success-green); }
.btn-primary:disabled { background-color: #aaa; }
@media (max-width: 900px) { .trader-layout { grid-template-columns: 1fr; } }

/* 모달 스타일 (기존과 동일) */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 500px; }
.trade-history-list { list-style: none; padding: 0; max-height: 400px; overflow-y: auto; }
.trade-history-list li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
.history-action.buy { color: var(--primary-blue); font-weight: bold; }
.history-action.sell { color: var(--success-green); font-weight: bold; }
.btn-secondary { background-color: var(--text-light); color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; margin-top: 20px; }
</style>