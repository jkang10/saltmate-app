<template>
  <div class="assets-container">
    <header class="page-header">
      <h1><i class="fas fa-wallet"></i> 나의 통합 자산 현황</h1>
      <p>보유 중인 모든 재화와 아이템을 한눈에 확인하고 관리하세요.</p>
    </header>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>자산 정보를 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>

    <main v-else class="assets-grid">
      <section class="asset-card main-assets">
        <h2 class="card-title"><i class="fas fa-coins"></i> 주요 자산</h2>
        <div class="asset-item">
          <div class="item-info">
            <span class="item-name">SaltMate 포인트</span>
            <span class="item-value highlight">{{ (userProfile.saltmatePoints || 0).toLocaleString() }} S</span>
          </div>
        </div>
        <div class="asset-item">
          <div class="item-info">
            <span class="item-name">현금성 수익</span>
            <span class="item-value">{{ (userProfile.cashBalance || 0).toLocaleString() }} 원</span>
          </div>
        </div>
        <div class="asset-item">
          <div class="item-info">
            <span class="item-name">거래용 소금</span>
            <span class="item-value">{{ (userProfile.saltBalance || 0).toLocaleString() }} 개</span>
          </div>
          <router-link to="/salt-trader" class="btn-action">거래소 이동</router-link>
        </div>
      </section>

      <section class="asset-card game-assets">
        <h2 class="card-title"><i class="fas fa-gamepad"></i> 게임 재화</h2>
        <div class="asset-item">
          <div class="item-info">
            <span class="item-name">소금광산 - 채굴한 소금</span>
            <span class="item-value">{{ (saltMineState.salt || 0).toLocaleString() }} 개</span>
          </div>
          <button @click="convertSaltToPoints" class="btn-action">SaltMate로 전환</button>
        </div>
        <div class="asset-item">
          <div class="item-info">
            <span class="item-name">소금광산 - 황금 소금</span>
            <span class="item-value">{{ (saltMineState.gold || 0).toLocaleString() }} 개</span>
          </div>
          <button @click="convertGoldenSaltToPoints" class="btn-action">SaltMate로 전환</button>
        </div>
         <div class="asset-item">
          <div class="item-info">
            <span class="item-name">해양탐사 - 자금</span>
            <span class="item-value">{{ (deepSeaState.funds || 0).toLocaleString() }}</span>
          </div>
          <button @click="convertFundsToPoints" class="btn-action">SaltMate로 전환</button>
        </div>
        <div class="asset-item">
          <div class="item-info">
            <span class="item-name">해양탐사 - 심층수</span>
            <span class="item-value">{{ (deepSeaState.water || 0).toLocaleString() }} L</span>
          </div>
        </div>
        <div class="asset-item">
          <div class="item-info">
            <span class="item-name">해양탐사 - 희귀 미네랄</span>
            <span class="item-value">{{ (deepSeaState.minerals || 0).toLocaleString() }} 개</span>
          </div>
        </div>
      </section>

      <section class="asset-card token-assets">
        <h2 class="card-title"><i class="fas fa-database"></i> 보유 토큰</h2>
        <div class="asset-item">
          <img src="@/assets/COBS.png" alt="COBS" class="token-icon" />
          <div class="item-info">
            <span class="item-name">COBS</span>
            <span class="item-value">{{ (userProfile.tokens?.cobs || 0).toLocaleString() }}</span>
          </div>
        </div>
        <div class="asset-item">
          <img src="@/assets/BND_LOGO.png" alt="BND" class="token-icon" />
          <div class="item-info">
            <span class="item-name">BND</span>
            <span class="item-value">{{ (userProfile.tokens?.bnd || 0).toLocaleString() }}</span>
          </div>
        </div>
        <div class="asset-item">
          <img src="@/assets/SSC_LOGO.png" alt="SSC" class="token-icon" />
          <div class="item-info">
            <span class="item-name">SSC</span>
            <span class="item-value">{{ (userProfile.tokens?.ssc || 0).toLocaleString() }}</span>
          </div>
        </div>
      </section>

      <section class="asset-card coupon-assets">
        <h2 class="card-title"><i class="fas fa-ticket-alt"></i> 보유 쿠폰 ({{ coupons.length }}개)</h2>
        <div v-if="coupons.length > 0" class="coupon-list">
          <div v-for="coupon in coupons" :key="coupon.id" class="coupon-item">
            <div class="coupon-info">
              <strong class="coupon-desc">{{ coupon.description }}</strong>
              <span class="coupon-expiry">유효기간: {{ formatDate(coupon.expiresAt) }}</span>
            </div>
            <span class="coupon-type">{{ coupon.type }}</span>
          </div>
        </div>
        <p v-else class="no-items">보유 중인 쿠폰이 없습니다.</p>
        <router-link to="/my-coupons" class="btn-full-width">쿠폰함 바로가기</router-link>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { auth, db, functions } from '@/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';

const userProfile = ref({});
const saltMineState = ref({});
const deepSeaState = ref({});
const coupons = ref([]);
const isLoading = ref(true);
const error = ref(null);

const fetchAssets = async () => {
  if (!auth.currentUser) {
    error.value = "로그인이 필요합니다.";
    isLoading.value = false;
    return;
  }
  const uid = auth.currentUser.uid;

  try {
    const userRef = doc(db, "users", uid);
    const saltMineRef = doc(db, "users", uid, "game_state", "salt_mine");
    const deepSeaRef = doc(db, "users", uid, "game_state", "deep_sea_exploration");
    const couponsQuery = query(
      collection(db, "users", uid, "coupons"),
      where("status", "==", "unused"),
      orderBy("expiresAt", "asc")
    );

    const [userSnap, saltMineSnap, deepSeaSnap, couponsSnap] = await Promise.all([
      getDoc(userRef),
      getDoc(saltMineRef),
      getDoc(deepSeaRef),
      getDocs(couponsQuery),
    ]);

    if (userSnap.exists()) userProfile.value = userSnap.data();
    if (saltMineSnap.exists()) saltMineState.value = saltMineSnap.data();
    if (deepSeaSnap.exists()) deepSeaState.value = deepSeaSnap.data();
    
    coupons.value = couponsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  } catch (e) {
    console.error("자산 정보 조회 오류:", e);
    error.value = "자산 정보를 불러오는 데 실패했습니다.";
  } finally {
    isLoading.value = false;
  }
};

const callGameFunction = async (functionName, data, successMessage) => {
  if (!confirm(successMessage.confirm)) return;
  try {
    const func = httpsCallable(functions, functionName);
    const result = await func(data);
    alert(successMessage.success(result.data));
    await fetchAssets(); // 데이터 새로고침
  } catch (e) {
    console.error(`${functionName} 호출 오류:`, e);
    alert(`오류: ${e.message}`);
  }
};

const convertSaltToPoints = () => {
  const amountToSell = prompt("SaltMate 포인트로 전환할 소금의 양을 입력하세요.", saltMineState.value.salt || 0);
  if (amountToSell) {
    callGameFunction('sellSaltForPoints', { amountToSell: Number(amountToSell) }, {
      confirm: `${Number(amountToSell).toLocaleString()}개의 소금을 SaltMate 포인트로 전환하시겠습니까?`,
      success: (data) => `${data.soldSalt.toLocaleString()}개의 소금이 ${data.awardedPoints.toLocaleString()} SaltMate 포인트로 전환되었습니다!`
    });
  }
};

const convertGoldenSaltToPoints = () => {
  const quantity = prompt("전환할 황금 소금의 개수를 입력하세요.", saltMineState.value.gold || 1);
   if (quantity) {
    callGameFunction('exchangeGoldenSalt', { quantity: Number(quantity) }, {
      confirm: `황금 소금 ${Number(quantity).toLocaleString()}개를 SaltMate 포인트로 전환하시겠습니까?`,
      success: (data) => `황금 소금이 ${data.awardedPoints.toLocaleString()} SaltMate 포인트로 전환되었습니다!`
    });
  }
};

const convertFundsToPoints = () => {
  callGameFunction('sellDeepSeaFunds', {}, {
    confirm: `해양탐사 자금을 SaltMate 포인트로 전환하시겠습니까?`,
    success: (data) => `자금 ${data.soldFunds.toLocaleString()}이 ${data.awardedPoints.toLocaleString()} SaltMate 포인트로 전환되었습니다!`
  });
};

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return "N/A";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

onMounted(fetchAssets);
</script>

<style scoped>
.assets-container {
  padding: 20px;
  max-width: 1200px;
  margin: 70px auto 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 40px;
}
.page-header h1 {
  font-size: 2.5em;
  margin-bottom: 10px;
}
.page-header p {
  font-size: 1.1em;
  color: #666;
}
.loading-state, .error-state {
  text-align: center;
  padding: 50px;
  font-size: 1.2em;
}
.spinner {
  /* ... (spinner styles) ... */
}
.assets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 30px;
}
.asset-card {
  background: #fff;
  border-radius: 15px;
  padding: 25px;
  box-shadow: 0 8px 25px rgba(0,0,0,0.08);
}
.card-title {
  font-size: 1.5em;
  margin: 0 0 20px 0;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 10px;
}
.asset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid #f5f5f5;
}
.asset-item:last-child {
  border-bottom: none;
}
.item-info {
  display: flex;
  flex-direction: column;
}
.item-name {
  font-size: 1em;
  color: #555;
  margin-bottom: 5px;
}
.item-value {
  font-size: 1.4em;
  font-weight: 700;
  color: #333;
}
.item-value.highlight {
  color: #007bff;
}
.btn-action {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.2s;
}
.btn-action:hover {
  background-color: #0056b3;
}
.token-icon {
  width: 40px;
  height: 40px;
  margin-right: 15px;
}
.coupon-list {
  max-height: 300px;
  overflow-y: auto;
}
.coupon-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 5px;
  border-bottom: 1px solid #f0f0f0;
}
.coupon-info {
  display: flex;
  flex-direction: column;
}
.coupon-desc {
  font-weight: bold;
}
.coupon-expiry {
  font-size: 0.8em;
  color: #777;
}
.coupon-type {
  font-size: 0.8em;
  background-color: #e9ecef;
  padding: 3px 8px;
  border-radius: 10px;
  color: #495057;
}
.no-items {
  text-align: center;
  color: #888;
  padding: 20px 0;
}
.btn-full-width {
  display: block;
  width: 100%;
  text-align: center;
  background-color: #28a745;
  color: white;
  padding: 12px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  margin-top: 20px;
  transition: background-color 0.2s;
}
.btn-full-width:hover {
  background-color: #218838;
}
</style>