<template>
  <div class="page-container auction-page">
    <header class="page-header">
      <h1><i class="fas fa-gavel"></i> 주간 경매장</h1>
      <p>최고가에 도전하여 이번 주 특별 아이템을 획득하세요!</p>
    </header>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>경매 정보를 불러오는 중입니다...</p>
    </div>

    <div v-else-if="auction.active" class="auction-card">
      <div class="prize-section">
        <div class="prize-icon-wrapper">
          <i class="fas fa-gem prize-icon"></i>
        </div>
        <div class="prize-details">
          <h2>{{ auction.active.prizeName }}</h2>
          <p>{{ auction.active.prizeDescription }}</p>
        </div>
      </div>

      <div class="bidding-core">
        <div class="highest-bid-display">
          <div class="bid-aura"></div>
          <small>현재 최고 입찰가</small>
          <strong>{{ (auction.active.highestBid || 0).toLocaleString() }}</strong>
          <span>SaltMate</span>
        </div>

        <div class="countdown-timer">
          <h3><i class="fas fa-clock"></i> 경매 마감까지</h3>
          <div class="countdown">{{ countdown }}</div>
        </div>

        <div class="bid-action-area">
          <form @submit.prevent="placeBid" class="bid-form">
            <div class="input-wrapper">
              <i class="fas fa-coins"></i>
              <input 
                type="number" 
                v-model="bidAmount" 
                :placeholder="`입찰가 입력 (최소 ${(auction.active.highestBid || 0) + 1})`" 
                :min="(auction.active.highestBid || 0) + 1"
                required>
            </div>
            <button type="submit" :disabled="isBidding || !isAuctionActive" class="btn-bid">
              <span v-if="isBidding" class="spinner-small"></span>
              <span v-else>{{ isAuctionActive ? '입찰 참여' : '경매 마감' }}</span>
            </button>
          </form>
          <p v-if="error" class="error-message">{{ error }}</p>
        </div>
      </div>
    </div>
    
    <div v-else-if="!isLoading && nextAuctionPreview" class="card-placeholder coming-soon">
      <h3><i class="fas fa-hourglass-start"></i> 다음 경매 예고</h3>
      <h2>{{ nextAuctionPreview.prizeName }}</h2>
      <p>{{ nextAuctionPreview.prizeDescription }}</p>
      <div class="next-auction-time">
        다음 주 월요일 00:30에 시작됩니다.
      </div>
    </div>

    <div v-else class="card-placeholder">
      <p>현재 진행 중인 경매가 없습니다. 다음 주 월요일 00:30에 새로운 경매가 시작됩니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { db, functions } from '@/firebaseConfig';
import { doc, onSnapshot, getDoc } from 'firebase/firestore'; // [신규 추가] getDoc
import { httpsCallable } from 'firebase/functions';

const auction = reactive({ active: null });
const bidAmount = ref(null);
const isBidding = ref(false);
const error = ref('');
const countdown = ref('00:00:00');
let unsubscribe = null;
let countdownInterval = null;

const isLoading = ref(true); // [신규 추가]
const nextAuctionPreview = ref(null); // [신규 추가]

const getWeekId = () => {
  const nowKST = new Date();
  const dayOfWeek = nowKST.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(nowKST);
  monday.setDate(nowKST.getDate() + diff);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, '0');
  const d = String(monday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isAuctionActive = computed(() => {
    if (!auction.active?.endTime) return false;
    return auction.active.endTime.toDate() > new Date();
});

onMounted(() => {
  const weekId = getWeekId();
  if (!weekId) {
    isLoading.value = false;
    return;
  }
  
  const auctionRef = doc(db, "auctions", weekId);
  
  // [★수정★] onSnapshot 로직 수정
  unsubscribe = onSnapshot(auctionRef, async (docSnap) => {
    if (docSnap.exists() && docSnap.data().status === 'active') {
      // 1. 활성 경매가 있으면 표시
      auction.active = { id: docSnap.id, ...docSnap.data() };
      nextAuctionPreview.value = null; // 예고 숨김
      startCountdown();
      isLoading.value = false;
    } else {
      // 2. 활성 경매가 없으면, 다음 주 예고를 불러옴
      auction.active = null;
      if (countdownInterval) clearInterval(countdownInterval);
      
      try {
        const nextAuctionRef = doc(db, "configuration", "nextAuctionSetting");
        const nextSnap = await getDoc(nextAuctionRef);
        if (nextSnap.exists()) {
          nextAuctionPreview.value = nextSnap.data();
        } else {
          nextAuctionPreview.value = null;
        }
      } catch (e) {
        console.error("다음 경매 예고 로딩 실패:", e);
        nextAuctionPreview.value = null;
      } finally {
        isLoading.value = false;
      }
    }
  }, (error) => {
      console.error("경매 정보 구독 실패:", error);
      isLoading.value = false;
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
  if (countdownInterval) clearInterval(countdownInterval);
});

const startCountdown = () => {
    // (기존과 동일)
    if(countdownInterval) clearInterval(countdownInterval);
    if (!auction.active?.endTime) return;
    countdownInterval = setInterval(() => {
        const now = new Date();
        const end = auction.active.endTime.toDate();
        const diff = end.getTime() - now.getTime();
        if (diff <= 0) {
            countdown.value = '경매가 종료되었습니다';
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
  // (기존과 동일)
  if (!bidAmount.value || !auction.active?.id) return;
  isBidding.value = true;
  error.value = '';
  try {
    const placeAuctionBid = httpsCallable(functions, 'placeAuctionBid');
    await placeAuctionBid({ weekId: auction.active.id, bidAmount: Number(bidAmount.value) });
    bidAmount.value = null;
    alert('입찰에 성공했습니다! 당신이 현재 최고 입찰자입니다.');
  } catch(e) {
    error.value = e.message;
  } finally {
    isBidding.value = false;
  }
};
</script>

<style scoped>
/* (기존 스타일 대부분은 동일) */
.auction-page {
  padding: 20px;
  background-color: #f0f2f5;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  color: #1e293b;
  font-size: 2.5em;
  margin-bottom: 10px;
}
.page-header h1 i {
  color: #c0392b;
}
.page-header p {
  color: #475569;
  font-size: 1.1em;
}

/* [신규 추가] 로딩 스피너 컨테이너 */
.loading-container {
  text-align: center;
  padding: 50px;
  background: #fff;
  border-radius: 16px;
  max-width: 700px;
  margin: 0 auto;
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
}
.loading-spinner {
  border: 4px solid rgba(0,0,0,0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  display: inline-block;
  margin-bottom: 15px;
}
/* (spin 키프레임은 하단에 이미 있음) */

.auction-card {
  max-width: 700px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 16px;
  padding: 40px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
  text-align: center;
}

.prize-section {
  display: flex;
  align-items: center;
  gap: 25px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 30px;
  margin-bottom: 30px;
}
.prize-icon-wrapper {
  font-size: 3.5em;
  color: #f59e0b;
}
.prize-details h2 {
  margin: 0 0 8px;
  font-size: 1.8em;
  color: #1e293b;
}
.prize-details p {
  margin: 0;
  color: #64748b;
}

.bidding-core {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.highest-bid-display {
  padding: 30px;
  border-radius: 15px;
  position: relative;
  overflow: hidden;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}
.highest-bid-display small {
  display: block;
  margin-bottom: 10px;
  color: #64748b;
  font-size: 1.1em;
}
.highest-bid-display strong {
  font-size: 3.5em;
  font-weight: 700;
  color: #c0392b;
  animation: fire-text 2s infinite alternate;
}
@keyframes fire-text {
  from { text-shadow: 0 0 5px #f56565, 0 0 10px #f56565, 0 0 20px #c0392b; }
  to { text-shadow: 0 0 10px #f6ad55, 0 0 20px #f6ad55, 0 0 30px #f56565; }
}
.highest-bid-display span {
  font-size: 1.2em;
  margin-left: 10px;
  color: #c0392b;
  font-weight: 500;
}

.countdown-timer h3 {
  margin: 0 0 10px;
  font-size: 1.1em;
  color: #64748b;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.countdown {
  font-size: 2.2em;
  font-weight: bold;
  color: #1e293b;
  font-family: 'Courier New', Courier, monospace;
}

.bid-action-area {
  max-width: 400px;
  width: 100%;
  margin: 0 auto;
}

.bid-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.input-wrapper {
  position: relative;
}
.input-wrapper .fas {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}
.bid-form input {
  width: 100%;
  padding: 18px 20px 18px 50px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #1e293b;
  border-radius: 12px;
  font-size: 1.2em;
  text-align: center;
}
.bid-form input::placeholder {
  color: #94a3b8;
}

.btn-bid {
  padding: 18px;
  border: none;
  border-radius: 12px;
  font-size: 1.4em;
  font-weight: bold;
  cursor: pointer;
  background: linear-gradient(135deg, #e53e3e, #c0392b);
  color: white;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}
.btn-bid:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(192, 57, 43, 0.4);
}
.btn-bid::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 5px;
  height: 5px;
  background: rgba(255, 255, 255, 0.5);
  opacity: 0;
  border-radius: 100%;
  transform: scale(1, 1) translate(-50%);
  transform-origin: 50% 50%;
}
@keyframes ripple {
  0% { transform: scale(0, 0); opacity: 1; }
  100% { transform: scale(100, 100); opacity: 0; }
}
.btn-bid:focus:not(:active)::after {
  animation: ripple 1s ease-out;
}
.btn-bid:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  color: #e2e8f0;
}

.error-message { color: #e53e3e; margin-top: 15px; }

/* [수정] card-placeholder 스타일 */
.card-placeholder {
  background: #ffffff;
  border-radius: 16px; 
  padding: 50px; 
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
  color: #64748b;
  max-width: 700px;
  margin: 0 auto;
  text-align: center; /* [추가] */
}

/* [★신규★] 다음 경매 예고 스타일 */
.card-placeholder.coming-soon {
  border: 2px dashed #007bff;
  background: #f8f9fa;
}
.card-placeholder.coming-soon h3 {
  font-size: 1.2rem;
  color: #007bff;
  margin: 0 0 10px;
}
.card-placeholder.coming-soon h2 {
  font-size: 2rem;
  color: #333;
  margin: 0 0 15px;
}
.card-placeholder.coming-soon p {
  font-size: 1rem;
  color: #555;
  margin-bottom: 25px;
}
.next-auction-time {
  font-weight: bold;
  color: #1e293b;
  background: #e9ecef;
  padding: 10px 15px;
  border-radius: 8px;
  display: inline-block;
}

.spinner-small {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>