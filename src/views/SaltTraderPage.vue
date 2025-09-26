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
  </div>

<div v-if="isHistoryModalVisible" class="modal-overlay" @click.self="isHistoryModalVisible = false">
  <div class="modal-content">
    <h3>소금 거래 내역</h3>
    <div v-if="isLoadingHistory" class="spinner-small"></div>
    <ul v-else-if="tradeHistory.length > 0">
      <li v-for="item in tradeHistory" :key="item.id">
        <span>{{ new Date(item.timestamp.seconds * 1000).toLocaleString() }}</span>
        <span :class="item.action">{{ item.action === 'buy' ? '매수' : '매도' }}</span>
        <span>{{ item.quantity }}개 ({{ item.price }}/개)</span>
      </li>
    </ul>
    <p v-else>거래 내역이 없습니다.</p>
    <button @click="isHistoryModalVisible = false">닫기</button>
  </div>
</div>
</template>

 context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  const uid = context.auth.uid;

  const { action, quantity } = data;
  if (!['buy', 'sell'].includes(action) || !quantity || quantity <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "거래 정보가 올바르지 않습니다.");
  }

  const userRef = db.collection("users").doc(uid);
  const marketRef = db.collection("configuration").doc("saltMarket");
  // [신규] 거래 기록을 저장할 경로
  const historyRef = userRef.collection("saltTradeHistory").doc(); 

  try {
    await db.runTransaction(async (transaction) => {
      const [userDoc, marketDoc] = await Promise.all([
        transaction.get(userRef),
        transaction.get(marketRef)
      ]);
      if(!userDoc.exists || !marketDoc.exists) throw new functions.https.HttpsError("not-found", "데이터를 찾을 수 없습니다.");
      
      const userData = userDoc.data();
      const marketData = marketDoc.data();
      const price = marketData.currentPrice;

      // [신규] 거래 기록 데이터 생성
      const historyData = {
        action,
        quantity,
        price,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };

      if(action === 'buy') {
        const cost = price * quantity;
        if((userData.saltmatePoints || 0) < cost) throw new functions.https.HttpsError("failed-precondition", "SaltMate 포인트가 부족합니다.");
        transaction.update(userRef, {
          saltmatePoints: admin.firestore.FieldValue.increment(-cost),
          saltBalance: admin.firestore.FieldValue.increment(quantity)
        });
        historyData.totalCost = cost;
      } else { // sell
        if((userData.saltBalance || 0) < quantity) throw new functions.https.HttpsError("failed-precondition", "보유한 소금이 부족합니다.");
        const revenue = price * quantity;
        transaction.update(userRef, {
          saltmatePoints: admin.firestore.FieldValue.increment(revenue),
          saltBalance: admin.firestore.FieldValue.increment(-quantity)
        });
        historyData.totalRevenue = revenue;
      }
      
      // [신규] 트랜잭션에 거래 기록 저장 추가
      transaction.set(historyRef, historyData);
    });

    return { success: true, message: "거래가 성공적으로 체결되었습니다." };
  } catch(error) {
    console.error("소금 거래 오류:", error);
    if(error.code) throw error;
    throw new functions.https.HttpsError("internal", "거래 처리 중 오류가 발생했습니다.");
  }
});
2단계: SaltTraderPage.vue에 내역 확인 모달 추가
백엔드 수정 후, SaltTraderPage.vue에 모달 관련 코드를 추가합니다. 아래 코드로 <script setup> 블록을 전체 교체해주세요. (기존 로직 포함)

JavaScript

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

// --- [신규] 모달 관련 상태 변수 추가 ---
const isHistoryModalVisible = ref(false);
const tradeHistory = ref([]);
const isLoadingHistory = ref(false);
// --- (기존 상태 변수들은 그대로) ---
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

// --- [신규] 모달 열기/닫기 및 데이터 조회 함수 ---
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
.btn-buy { background-color: #007bff; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; }
.btn-sell { background-color: #28a745; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; }
.btn-primary:disabled { background-color: #aaa; }

/* [추가] 모바일 화면(768px 이하)에서 세로로 배열되도록 미디어 쿼리 추가 */
@media (max-width: 768px) {
  .trade-form {
    grid-template-columns: 1fr;
  }
}
</style>