<template>
  <div class="page-container auction-page">
    <header class="page-header">
      <h1><i class="fas fa-gavel"></i> 주간 경매장</h1>
      <p>최고가에 도전하여 이번 주 특별 아이템을 획득하세요!</p>
    </header>

    <div v-if="auction.active" class="auction-card">
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
    
    <div v-else class="card-placeholder">
      <p>현재 진행 중인 경매가 없습니다. 다음 주 월요일 00:30에 새로운 경매가 시작됩니다.</p>
    </div>
  </div>
</template>

<script setup>
// ... 스크립트 내용은 이전과 동일 ...
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { db, functions } from '@/firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const auction = reactive({ active: null });
const bidAmount = ref(null);
const isBidding = ref(false);
const error = ref('');
const countdown = ref('00:00:00');
let unsubscribe = null;
let countdownInterval = null;

const getWeekId = () => {
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const dayOfWeek = kstNow.getUTCDay();
    const monday = new Date(kstNow);
    monday.setUTCDate(kstNow.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    return monday.toISOString().slice(0,10);
};

const isAuctionActive = computed(() => {
    if (!auction.active?.endTime) return false;
    return auction.active.endTime.toDate() > new Date();
});

onMounted(() => {
  const weekId = getWeekId();
  if (!weekId) return;
  const auctionRef = doc(db, "auctions", weekId);
  unsubscribe = onSnapshot(auctionRef, (docSnap) => {
    if (docSnap.exists()) {
      auction.active = { id: docSnap.id, ...docSnap.data() };
      startCountdown();
    } else {
      auction.active = null;
    }
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
  if (countdownInterval) clearInterval(countdownInterval);
});

const startCountdown = () => {
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
/* ... 이전 스타일 내용은 대부분 그대로 유지 ... */

/* 페이지 전체 스타일 */
.auction-page {
  text-align: center;
  background: linear-gradient(180deg, #1b2838 0%, #0f1c2a 100%);
  color: #e0e0e0;
  padding-bottom: 50px;
}
.page-header h1 { color: #fff; }
.page-header p { color: #a0a0a0; }

/* 메인 경매 카드 */
.auction-card {
  background: rgba(10, 25, 41, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 700px;
  margin: 0 auto;
}

/* 상품 정보 섹션 */
.prize-section {
  display: flex;
  align-items: center;
  gap: 25px;
  text-align: left;
  background: rgba(0,0,0,0.2);
  padding: 25px;
  border-radius: 15px;
  margin-bottom: 40px;
}
.prize-icon-wrapper {
  font-size: 3.5em;
  color: #ffd700;
  text-shadow: 0 0 20px #ffd700;
}
.prize-details h2 {
  margin: 0 0 8px;
  font-size: 1.8em;
  color: #fff;
}
.prize-details p {
  margin: 0;
  color: #bdc3c7;
}

/* 입찰 핵심 정보 섹션 */
.bidding-core {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* 최고 입찰가 디스플레이 */
.highest-bid-display {
  background: rgba(0,0,0,0.3);
  padding: 30px;
  border-radius: 15px;
  position: relative;
  overflow: hidden;
}
.highest-bid-display small {
  display: block;
  margin-bottom: 10px;
  color: #a0a0a0;
  font-size: 1.1em;
}
.highest-bid-display strong {
  font-size: 3.5em;
  font-weight: 700;
  color: #ffd700;
  text-shadow: 0 0 15px rgba(255, 215, 0, 0.5);
}
.highest-bid-display span {
  font-size: 1.2em;
  margin-left: 10px;
  color: #ffd700;
  font-weight: 500;
}
.bid-aura {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0) 65%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: aura-pulse 3s infinite alternate;
}
@keyframes aura-pulse {
  from { transform: translate(-50%, -50%) scale(0.9); opacity: 0.8; }
  to { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
}

/* 카운트다운 타이머 */
.countdown-timer {
  background: transparent;
  padding: 0;
}
.countdown-timer h3 {
  margin: 0 0 10px;
  font-size: 1.1em;
  color: #bdc3c7;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.countdown {
  font-size: 2.2em;
  font-weight: bold;
  color: #e74c3c;
  font-family: 'Courier New', Courier, monospace;
  text-shadow: 0 0 10px rgba(231, 76, 60, 0.5);
}

/* ==================== [핵심 수정] 입찰 폼 영역 스타일 추가 ==================== */
.bid-action-area {
  max-width: 400px; /* 폼의 최대 너비를 제한 */
  width: 100%;
  margin: 0 auto; /* 중앙 정렬 */
}
/* ============================================================================ */

/* 입찰 폼 */
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
  color: #888;
}
.bid-form input {
  width: 100%;
  padding: 18px 20px 18px 50px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0,0,0,0.4);
  color: #fff;
  border-radius: 12px;
  font-size: 1.2em;
  text-align: center;
}
.bid-form input::placeholder {
  color: #888;
}
.btn-bid {
  padding: 18px;
  border: none;
  border-radius: 12px;
  font-size: 1.4em;
  font-weight: bold;
  cursor: pointer;
  background: linear-gradient(90deg, #f7971e, #ffd200);
  color: #333;
  transition: all 0.3s ease;
}
.btn-bid:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}
.btn-bid:disabled {
  background: #555;
  cursor: not-allowed;
  color: #999;
}
.error-message { color: #e74c3c; margin-top: 15px; }

.card-placeholder {
  background: rgba(10, 25, 41, 0.8);
  border-radius: 16px; 
  padding: 50px; 
  box-shadow: 0 8px 30px rgba(0,0,0,0.1);
  color: #a0a0a0;
}

.spinner-small {
  border: 2px solid rgba(0, 0, 0, 0.3);
  border-top: 2px solid #333;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>