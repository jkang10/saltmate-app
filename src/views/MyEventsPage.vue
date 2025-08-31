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
      <div v-else class="coupon-list">
        <div v-for="coupon in coupons" :key="coupon.id" class="coupon-item" :class="coupon.status">
          <div class="coupon-icon"><i class="fas fa-cut"></i></div>
          <div class="coupon-details">
            <h4>소금 광산 채굴 부스트 (+{{ coupon.boostPercentage }}%)</h4>
            <p><strong>효과:</strong> {{ coupon.durationMinutes }}분 동안 채굴 효율 증가</p>
            <small>유효기간: ~{{ formatDate(coupon.expiresAt) }}</small>
          </div>
          <button @click="useCoupon(coupon.id)" class="btn btn-use" :disabled="coupon.status !== 'unused' || isUsing">
             <span v-if="isUsing" class="spinner-small"></span>
             <span v-else-if="coupon.status === 'used'">사용 완료</span>
             <span v-else-if="coupon.status === 'expired'">기간 만료</span>
             <span v-else>사용하기</span>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { auth, db, functions } from '@/firebaseConfig';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useRouter } from 'vue-router';

const coupons = ref([]);
const isLoading = ref(true);
const isUsing = ref(false);
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
    coupons.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("쿠폰 로딩 실패:", error);
  } finally {
    isLoading.value = false;
  }
};

const useCoupon = async (couponId) => {
  if (!confirm("쿠폰을 사용하시겠습니까? 사용 즉시 효과가 적용됩니다.")) return;
  isUsing.value = true;
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
  }
};

onMounted(fetchCoupons);
</script>

<style scoped>
.my-events-page {
  padding: 20px;
  max-width: 1000px;
  margin: 70px auto 20px auto;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.page-header {
  text-align: center;
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 2.8em;
  color: #333;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
}

.page-header h1 i {
  color: #e67e22; /* 이벤트 아이콘 색상 */
}

.page-header .description {
  font-size: 1.1em;
  color: #666;
}

.content-wrapper {
  padding: 30px;
  text-align: center;
}

.content-wrapper h2 {
  font-size: 2em;
  color: #333;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 15px;
}

.content-wrapper p {
  font-size: 1.1em;
  color: #555;
  margin-bottom: 20px;
  line-height: 1.6;
}

.card.glassmorphism {
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.back-button {
  background-color: #6c757d;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  text-decoration: none;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.back-button:hover {
  background-color: #5a6268;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  .page-header h1 {
    font-size: 2.2em;
  }
  .content-wrapper {
    padding: 20px;
  }
  .content-wrapper h2 {
    font-size: 1.8em;
  }
  .back-button {
    padding: 10px 20px;
    font-size: 0.9em;
  }
}
</style>
