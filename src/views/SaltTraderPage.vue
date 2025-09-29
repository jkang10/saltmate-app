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
          <div class="asset-item salt" @click="openHistoryModal" title="클릭하여 내 거래 내역 확인">
            <span>보유 소금</span>
            <strong>{{ (userProfile?.saltBalance || 0).toLocaleString() }}</strong>
          </div>
        </div>

	<div class="card order-card">
	  <h3><i class="fas fa-tasks"></i> 주문 실행</h3>
	  <div class="trade-section">
	    <h4>소금 사기 (매수)</h4>
	    <div class="input-group">
	      <input type="number" v-model.number="buyQuantity" min="1" placeholder="수량" class="trade-input">
	      <button @click="trade('buy')" class="btn-trade btn-buy" :disabled="isTrading || !buyQuantity || buyQuantity <= 0">매수</button>
	    </div>
	    <p class="trade-summary">예상 비용: {{ (buyQuantity * (market?.currentPrice || 0)).toLocaleString() }} SaltMate</p>
	  </div>
	  <div class="trade-section">
	    <h4>소금 팔기 (매도)</h4>
	    <div class="input-group">
	      <input type="number" v-model.number="sellQuantity" min="1" placeholder="수량" class="trade-input">
	      <button @click="trade('sell')" class="btn-trade btn-sell" :disabled="isTrading || !sellQuantity || sellQuantity <= 0">매도</button>
	    </div>
	    <p class="trade-summary">예상 수익: {{ (sellQuantity * (market?.currentPrice || 0)).toLocaleString() }} SaltMate</p>
	  </div>
	   <p v-if="error" class="error-message">{{ error }}</p>
	</div>

        <div class="card recent-trades-card">
            <h3><i class="fas fa-history"></i> 실시간 체결 내역</h3>
            <ul class="trades-list">
                <li v-for="trade in recentTrades" :key="trade.id" :class="trade.action">
                    <span class="trade-time">{{ new Date(trade.timestamp.seconds * 1000).toLocaleTimeString('ko-KR') }}</span>
                    <span class="trade-action">{{ trade.action === 'buy' ? '매수' : '매도' }}</span>
                    <span class="trade-price">{{ trade.price.toLocaleString() }}</span>
                    <span class="trade-quantity">{{ trade.quantity.toLocaleString() }}</span>
                </li>
            </ul>
        </div>
      </aside>

      <main class="right-panel">
        <div class="card market-card">
            <div class="market-header">
                <h3><i class="fas fa-gem"></i> 소금(SALT) 시세 정보</h3>
                <p class="current-price" :class="priceClass">{{ (market?.currentPrice || 0).toLocaleString() }} SaltMate</p>
            </div>
            <div class="market-stats">
                <div class="stat-item">
                    <span class="label">24h 변동</span>
                    <strong :class="priceClass">{{ priceChange.toFixed(2) }}% ({{ priceChangeAbsolute.toLocaleString() }})</strong>
                </div>
                <div class="stat-item">
                    <span class="label">24h 최고가</span>
                    <strong>{{ twentyFourHourHigh.toLocaleString() }}</strong>
                </div>
                <div class="stat-item">
                    <span class="label">24h 최저가</span>
                    <strong>{{ twentyFourHourLow.toLocaleString() }}</strong>
                </div>
            </div>
            <div class="chart-container">
                <v-chart class="chart" :option="chartOption" autoresize />
            </div>
        </div>
      </main>
    </div>
    
    <div v-if="isHistoryModalVisible" class="modal-overlay" @click.self="isHistoryModalVisible = false">
      <div class="modal-content">
        <h3><i class="fas fa-book"></i> 나의 소금 거래 내역</h3>
        <div v-if="isLoadingHistory" class="spinner-small"></div>
        <ul v-else-if="tradeHistory.length > 0" class="trade-history-list">
          <li v-for="item in tradeHistory" :key="item.id">
            <span class="history-date">{{ new Date(item.timestamp.seconds * 1000).toLocaleString('ko-KR') }}</span>
            <span class="history-action" :class="item.action">{{ item.action === 'buy' ? '매수' : '매도' }}</span>
            <span class="history-details">{{ item.quantity.toLocaleString() }}개 ({{ item.price.toLocaleString() }}/개)</span>
          </li>
        </ul>
        <p v-else>거래 내역이 없습니다.</p>
        <button @click="isHistoryModalVisible = false" class="btn-secondary">닫기</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { db, functions, auth } from '@/firebaseConfig';
import { doc, onSnapshot, collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
// [핵심 추가] Candlestick 차트 import
import { LineChart, CandlestickChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent, DataZoomComponent } from 'echarts/components';
import VChart from 'vue-echarts';

use([CanvasRenderer, LineChart, CandlestickChart, TitleComponent, TooltipComponent, GridComponent, DataZoomComponent]);

const isHistoryModalVisible = ref(false);
const tradeHistory = ref([]);
const isLoadingHistory = ref(false);
const market = ref({ currentPrice: 0, priceHistory: [] });
const userProfile = ref(null);
const buyQuantity = ref(null);
const sellQuantity = ref(null);
const error = ref('');
const isTrading = ref(false);
const recentTrades = ref([]); // [핵심 추가]

let marketUnsubscribe = null;
let userUnsubscribe = null;
let recentTradesUnsubscribe = null; // [핵심 추가]

// [핵심 추가] 24시간 정보 계산
const priceChange = computed(() => {
    const history = market.value?.priceHistory || [];
    if (history.length < 2) return 0;
    const oldPrice = history[0].price;
    const newPrice = market.value.currentPrice;
    return ((newPrice - oldPrice) / oldPrice) * 100;
});

const priceChangeAbsolute = computed(() => {
    const history = market.value?.priceHistory || [];
    if (history.length < 2) return 0;
    return market.value.currentPrice - history[0].price;
});

const priceClass = computed(() => {
    if (priceChange.value > 0) return 'up';
    if (priceChange.value < 0) return 'down';
    return '';
});

const twentyFourHourHigh = computed(() => {
    const prices = (market.value?.priceHistory || []).map(p => p.price);
    return prices.length > 0 ? Math.max(...prices, market.value.currentPrice) : 0;
});

const twentyFourHourLow = computed(() => {
    const prices = (market.value?.priceHistory || []).map(p => p.price);
    return prices.length > 0 ? Math.min(...prices, market.value.currentPrice) : 0;
});

// [핵심 수정] Candlestick 차트 데이터 가공
const candlestickData = computed(() => {
  const history = market.value?.priceHistory || [];
  if (history.length < 1) return [];
  const data = [];
  for (let i = 0; i < history.length; i++) {
    const current = history[i].price;
    const open = i > 0 ? history[i - 1].price : current;
    const close = current;
    const low = Math.min(open, close);
    const high = Math.max(open, close);
    data.push([open, close, low, high]);
  }
  return data;
});

// [핵심 수정] 차트 옵션을 Candlestick으로 변경
const chartOption = computed(() => {
    const history = market.value?.priceHistory || [];
    return {
        grid: { left: '10%', right: '5%', bottom: '20%' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: history.map(h => new Date(h.time.seconds * 1000).toLocaleTimeString('ko-KR')) },
        yAxis: { type: 'value', scale: true },
        dataZoom: [{ type: 'inside', start: 50, end: 100 }, { start: 50, end: 100 }],
        series: [{
            type: 'candlestick',
            data: candlestickData.value,
            itemStyle: {
                color: '#28a745', color0: '#dc3545',
                borderColor: '#28a745', borderColor0: '#dc3545'
            }
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

  // [핵심 추가] 실시간 체결 내역 리스너
  const tradesRef = collection(db, "recentTrades");
  const q = query(tradesRef, orderBy('timestamp', 'desc'), limit(15));
  recentTradesUnsubscribe = onSnapshot(q, (snapshot) => {
    recentTrades.value = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
  });
});

onUnmounted(() => {
    if(marketUnsubscribe) marketUnsubscribe();
    if(userUnsubscribe) userUnsubscribe();
    if(recentTradesUnsubscribe) recentTradesUnsubscribe(); // [핵심 추가]
});

const trade = async (action) => {
  error.value = '';
  isTrading.value = true;
  const quantity = action === 'buy' ? buyQuantity.value : sellQuantity.value;
  try {
    const tradeSalt = httpsCallable(functions, 'tradeSalt');
    await tradeSalt({ action: action, quantity: quantity });
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
}
.trade-section {
  padding-bottom: 20px;
  margin-bottom: 20px;
}
.trade-section:not(:last-child) {
  border-bottom: 1px solid #f0f0f0;
}
.input-group .trade-input {
  flex: 1; /* 남는 공간을 모두 차지하도록 설정 */
  min-width: 0; /* input이 flex 환경에서 넘치는 것을 방지하는 핵심 속성 */
  border: 1px solid #dee2e6;
  border-right: none; /* 버튼과 붙어 보이도록 오른쪽 테두리 제거 */
  padding: 12px;
  border-radius: 6px 0 0 6px; /* 왼쪽 모서리만 둥글게 */
  font-size: 1.1em;
  text-align: right;
}
.input-group .btn-trade {
  flex-shrink: 0; /* 버튼 너비가 줄어들지 않도록 설정 */
  border: 1px solid transparent;
  border-radius: 0 6px 6px 0; /* 오른쪽 모서리만 둥글게 */
  padding: 12px 20px;
  font-size: 1.1em;
  font-weight: bold;
  color: white;
  cursor: pointer;
}
/* [핵심 수정] 새로운 input-group 스타일 */
.input-group {
  display: flex;
  width: 100%;
}
.trade-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 1.1em;
  text-align: right;
  margin-bottom: 8px;
}
.trade-summary {
  text-align: right;
  margin-top: 8px; /* 간격 조정 */
}
.btn-trade {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 1.1em;
  font-weight: bold;
  color: white;
  cursor: pointer;
}
.page-container { max-width: 1200px; margin: 90px auto 20px; padding: 20px; }
.page-header { text-align: center; margin-bottom: 30px; }
.trader-layout { display: grid; grid-template-columns: 350px 1fr; gap: 24px; align-items: start; }
.card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
.left-panel, .right-panel { display: flex; flex-direction: column; gap: 24px; }
.asset-item { display: flex; justify-content: space-between; align-items: center; padding: 15px 0; }
.asset-item:not(:last-child) { border-bottom: 1px solid #dee2e6; }
.asset-item.salt:hover { background-color: #f8f9fa; }
.btn-buy { background-color: var(--primary-blue); }
.btn-sell { background-color: var(--success-green); }
button:disabled { background-color: #cccccc; cursor: not-allowed; }
.trade-summary { font-size: 0.9em; color: #6c757d; margin-top: 8px; text-align: right; }
.market-card { padding: 24px; }
.market-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.current-price { font-size: 2.5em; font-weight: 700; }
.current-price.up { color: var(--success-green); }
.current-price.down { color: var(--danger-red); }
.market-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; }
.stat-item { text-align: center; }
.stat-item .label { font-size: 0.9em; color: #6c757d; display: block; }
.stat-item strong { font-size: 1.1em; }
.stat-item strong.up { color: var(--success-green); }
.stat-item strong.down { color: var(--danger-red); }
.chart-container { height: 350px; }
.recent-trades-card ul { list-style: none; padding: 0; margin: 0; max-height: 250px; overflow-y: auto; }
.trades-list li { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; padding: 6px 0; font-family: monospace; }
.trades-list li.buy .trade-action { color: var(--primary-blue); }
.trades-list li.sell .trade-action { color: var(--success-green); }
.trade-price { font-weight: bold; }
@media (max-width: 900px) { .trader-layout { grid-template-columns: 1fr; } }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 500px; }
.trade-history-list { list-style: none; padding: 0; max-height: 400px; overflow-y: auto; }
.trade-history-list li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
.history-action.buy { color: var(--primary-blue); font-weight: bold; }
.history-action.sell { color: var(--success-green); font-weight: bold; }
.btn-secondary { background-color: #6c757d; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; margin-top: 20px; }
</style>