<template>
  <div class="my-events-page">
    <header class="page-header">
      <h1><i class="fas fa-gift"></i> 나의 이벤트 공간</h1>
      <p class="description">보유 쿠폰 현황을 확인하고 사용할 수 있습니다.</p>
    </header>

    <main class="content-wrapper card glassmorphism">
      <h2><i class="fas fa-ticket-alt"></i> 보유 쿠폰 목록</h2>
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
      </div>
      <div v-else-if="coupons.length === 0" class="empty-state">
        <p>현재 보유 중인 쿠폰이 없습니다.</p>
      </div>
      <div v-else class="coupon-grid">
        <div v-for="coupon in coupons" :key="coupon.id" class="coupon-card" :class="coupon.status">
          <div class="coupon-header">
            <i class="fas fa-receipt coupon-main-icon"></i>
            <span class="coupon-title">소금 광산 채굴 부스트</span>
          </div>
          <div class="coupon-body">
            <div class="coupon-effect">
              <i class="fas fa-chart-line"></i>
              <span>채굴 효율 <strong class="boost-percentage">+{{ coupon.boostPercentage }}%</strong> 증가</span>
            </div>
            <div class="coupon-duration">
              <i class="fas fa-hourglass-half"></i>
              <span>지속 시간: {{ coupon.durationMinutes }}분</span>
            </div>
            <div class="coupon-description">
              <i class="fas fa-info-circle"></i>
              <span>{{ coupon.description || '특별한 채굴 부스트 혜택!' }}</span>
            </div>
          </div>
          <div class="coupon-footer">
            <div class="coupon-expiry">
              <i class="fas fa-calendar-alt"></i>
              <span>유효기간: ~{{ formatDate(coupon.expiresAt) }}</span>
            </div>
            <button
              @click="useCoupon(coupon.id)"
              class="btn btn-use"
              :disabled="coupon.status !== 'unused' || isUsing"
            >
              <span v-if="isUsing && currentUsingCouponId === coupon.id" class="spinner-small"></span>
              <span v-else-if="coupon.status === 'used'">사용 완료</span>
              <span v-else-if="coupon.status === 'expired'">기간 만료</span>
              <span v-else>사용하기</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { auth, db, functions } from '@/firebaseConfig';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useRouter } from 'vue-router';

const coupons = ref([]);
const isLoading = ref(true);
const isUsing = ref(false);
const currentUsingCouponId = ref(null); // [신규] 어떤 쿠폰이 사용 중인지 추적
const router = useRouter();

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return "N/A";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

const fetchCoupons = async () => {
  isLoading.value = true;
  try {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/coupons`),
      orderBy("issuedAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    coupons.value = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // 만료일이 지난 쿠폰의 상태를 'expired'로 업데이트 (프론트엔드에서만 표시)
      if (data.status === 'unused' && data.expiresAt.toDate() < new Date()) {
        return { id: doc.id, ...data, status: 'expired' };
      }
      return { id: doc.id, ...data };
    });
  } catch (error) {
    console.error("쿠폰 로딩 실패:", error);
  } finally {
    isLoading.value = false;
  }
};

const useCoupon = async (couponId) => {
  if (!confirm("쿠폰을 사용하시겠습니까? 사용 즉시 효과가 적용됩니다.")) return;
  
  isUsing.value = true;
  currentUsingCouponId.value = couponId; // 어떤 쿠폰이 사용 중인지 기록
  try {
    const activateMiningBoost = httpsCallable(functions, "activateMiningBoost");
    const result = await activateMiningBoost({ couponId });
    alert(result.data.message);
    // 성공 시, 소금 광산 페이지로 이동하여 효과를 바로 체감하게 함
    router.push('/salt-mine-game');
  } catch (error) {
    console.error("쿠폰 사용 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isUsing.value = false;
    currentUsingCouponId.value = null; // 사용 완료/실패 후 초기화
    fetchCoupons(); // 쿠폰 상태 갱신을 위해 다시 불러오기
  }
};

onMounted(fetchCoupons);
</script>

<style scoped>
.my-events-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.page-header h1 {
  font-size: 2.5em;
  color: #2c3e50;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-header h1 .fas {
  margin-right: 15px;
  color: #ff9800; /* 선물 아이콘 색상 */
}

.description {
  color: #777;
  font-size: 1.1em;
}

.content-wrapper {
  background: linear-gradient(145deg, #ffffff, #e6e6e6);
  border-radius: 15px;
  padding: 30px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
}

.content-wrapper h2 {
  font-size: 2em;
  color: #2c3e50;
  margin-bottom: 25px;
  border-bottom: 2px solid #eee;
  padding-bottom: 15px;
  display: flex;
  align-items: center;
}

.content-wrapper h2 .fas {
  margin-right: 10px;
  color: #007bff; /* 티켓 아이콘 색상 */
}

.loading-state, .empty-state {
  text-align: center;
  padding: 50px 0;
  color: #888;
  font-size: 1.2em;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 20px auto;
}

.spinner-small {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-left-color: #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
  display: inline-block;
  vertical-align: middle;
  margin-right: 5px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* --- 쿠폰 카드 스타일 --- */
.coupon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 30px;
  padding-top: 10px;
}

.coupon-card {
  background: #ffffff;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  border: 1px solid #e0e0e0;
}

.coupon-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15);
}

.coupon-card.used, .coupon-card.expired {
  opacity: 0.7;
  filter: grayscale(80%);
  border-color: #bdbdbd;
}

.coupon-header {
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: #ffffff;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 1.4em;
  font-weight: bold;
}

.coupon-main-icon {
  font-size: 1.8em;
  color: #ffeb3b; /* 메인 아이콘 색상 */
}

.coupon-body {
  padding: 20px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.coupon-body > div {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #555;
  font-size: 1.05em;
}

.coupon-body > div .fas {
  color: #007bff;
  font-size: 1.2em;
}

.coupon-card.used .coupon-body > div .fas,
.coupon-card.expired .coupon-body > div .fas {
  color: #6c757d;
}

.boost-percentage {
  color: #28a745;
  font-weight: bold;
}

.coupon-description {
  font-style: italic;
  color: #777;
  border-top: 1px dashed #eee;
  padding-top: 10px;
  margin-top: 5px;
}

.coupon-footer {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #f9f9f9;
}

.coupon-expiry {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #888;
  font-size: 0.95em;
}

.coupon-expiry .fas {
  color: #ff9800; /* 유효기간 아이콘 색상 */
}

.btn-use {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  transition: background-color 0.3s ease, transform 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100px; /* 버튼 최소 너비 설정 */
}

.btn-use:hover:not(:disabled) {
  background-color: #218838;
  transform: translateY(-2px);
}

.btn-use:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
  box-shadow: none;
}
</style>