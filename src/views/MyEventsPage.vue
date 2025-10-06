<template>
  <div class="my-events-page">
    <header class="page-header">
      <h1><i class="fas fa-gift"></i> 나의 이벤트 공간</h1>
      <p class="description">보유 쿠폰 현황을 확인하고 사용하거나 삭제할 수 있습니다.</p>
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
        <div v-for="coupon in coupons" :key="coupon.id" class="coupon-card" :class="[coupon.status, `type-${coupon.type}`]">
          <div class="coupon-header">
            <i :class="['coupon-main-icon', getCouponIcon(coupon.type)]"></i>
            <span class="coupon-title">{{ formatCouponType(coupon.type) }}</span>
          </div>
          <div class="coupon-body">
            <ul class="details">
              <li v-if="coupon.boostPercentage"><i class="fas fa-bolt"></i> 채굴 효율 +{{ coupon.boostPercentage }}% 증가</li>
              <li v-if="coupon.durationMinutes"><i class="fas fa-hourglass-half"></i> 지속 시간: {{ coupon.durationMinutes }}분</li>
              <li v-if="coupon.quantity"><i class="fas fa-box"></i> 지급 수량: {{ coupon.quantity }}개</li>
            </ul>
            <p class="description">{{ coupon.description }}</p>
          </div>
          <div class="coupon-footer">
            <div class="coupon-expiry">
              <i class="fas fa-calendar-alt"></i>
              <span>유효기간: ~{{ formatDate(coupon.expiresAt) }}</span>
            </div>
            <div class="button-group">
              <button @click="useCoupon(coupon)" class="btn btn-use" :disabled="coupon.status !== 'unused' || isUsing === coupon.id">
                <span v-if="isUsing === coupon.id" class="spinner-small"></span>
                <span v-else>{{ formatStatus(coupon.status) }}</span>
              </button>
              <!-- [핵심 추가] 삭제 버튼 -->
              <button @click="deleteCoupon(coupon.id)" class="btn btn-delete" v-if="coupon.status !== 'unused'" title="쿠폰 삭제">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { auth, db } from '@/firebaseConfig'; // functions 제거
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { useRouter } from 'vue-router';

export default {
  name: 'MyEventsPage',
  setup() {
    const coupons = ref([]);
    const isLoading = ref(true);
    const isUsing = ref(null); // 어떤 쿠폰이 사용 중인지 ID로 추적
    const router = useRouter();
    let unsubscribe = null;

    const couponDetailsMap = {
        SALT_MINE_BOOST: { name: '소금 광산 부스트', icon: 'fas fa-gem' },
        DEEP_SEA_AUTOSELL: { name: '심해 자동판매', icon: 'fas fa-robot' },
        SALTPANG_TIME_PLUS_5: { name: '솔트팡 +5초', icon: 'fas fa-stopwatch' },
        SALTPANG_SCORE_X2_10S: { name: '솔트팡 점수 2배', icon: 'fas fa-sort-amount-up-alt' },
        ITEM_RARE_SALT: { name: '희귀 소금 결정', icon: 'fas fa-registered' },
        DEEP_SEA_RESEARCH: { name: '연구 데이터', icon: 'fas fa-flask' },
        DEEP_SEA_MINERAL: { name: '희귀 미네랄', icon: 'fas fa-atom' },
        DEEP_SEA_PLANKTON: { name: '플랑크톤', icon: 'fas fa-bacterium' },
        DEEP_SEA_RELIC: { name: '고대 유물', icon: 'fas fa-scroll' },
        DEEP_SEA_GOLDENTIME: { name: '해양 골든타임', icon: 'fas fa-star' },
    };

    const formatCouponType = (type) => couponDetailsMap[type]?.name || '알 수 없는 쿠폰';
    const getCouponIcon = (type) => couponDetailsMap[type]?.icon || 'fas fa-ticket-alt';
    const formatStatus = (status) => ({ unused: '사용하기', used: '사용 완료', expired: '기간 만료' }[status] || status);
    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return "N/A";
      return timestamp.toDate().toLocaleDateString("ko-KR");
    };

    const fetchCoupons = () => {
      if (auth.currentUser) {
        const q = query(collection(db, `users/${auth.currentUser.uid}/coupons`), orderBy("issuedAt", "desc"));
        unsubscribe = onSnapshot(q, (snapshot) => {
          coupons.value = snapshot.docs.map(doc => {
            const data = doc.data();
            if (data.status === 'unused' && data.expiresAt.toDate() < new Date()) {
              return { id: doc.id, ...data, status: 'expired' };
            }
            return { id: doc.id, ...data };
          });
          isLoading.value = false;
        });
      } else {
        isLoading.value = false;
      }
    };

const useCoupon = async (coupon) => {
  if (!confirm(`'${formatCouponType(coupon.type)}' 쿠폰을 사용하시겠습니까?`)) return;
  
  isUsing.value = coupon.id;
  try {
    let funcName = '';
    let payload = { couponId: coupon.id };

    if (coupon.type === 'SALT_MINE_BOOST') {
      funcName = 'activateMiningBoost';
    } else {
      // '희귀 소금 결정'을 포함한 나머지 모든 아이템 쿠폰은 useItemCoupon을 호출합니다.
      funcName = 'useItemCoupon';
    }

    const functionsWithRegion = getFunctions(auth.app, "asia-northeast3");
    const useCouponFunc = httpsCallable(functionsWithRegion, funcName);
    const result = await useCouponFunc(payload);
    alert(result.data.message);

    // [핵심 수정] 쿠폰 종류에 따라 해당하는 게임 페이지로 이동합니다.
    if (coupon.type === 'ITEM_RARE_SALT') {
      router.push('/salt-crystal-game');
    } else if (coupon.type.startsWith('SALT_MINE')) {
      router.push('/salt-mine-game');
    } else if (coupon.type.startsWith('DEEP_SEA')) {
      router.push('/deep-sea-game');
    } else if (coupon.type.startsWith('SALTPANG')) {
      router.push('/salt-pang');
    } else {
      // 그 외의 경우, 목록을 새로고침합니다.
      fetchCoupons();
    }
    
  } catch (error) {
    console.error("쿠폰 사용 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isUsing.value = null;
  }
};

    // [핵심 추가] 쿠폰 삭제 함수
    const deleteCoupon = async (couponId) => {
        if (!confirm("이 쿠폰을 목록에서 삭제하시겠습니까?")) return;
        try {
            if (!auth.currentUser) throw new Error("로그인이 필요합니다.");
            const couponRef = doc(db, `users/${auth.currentUser.uid}/coupons`, couponId);
            await deleteDoc(couponRef);
            alert("쿠폰이 삭제되었습니다.");
        } catch (error) {
            console.error("쿠폰 삭제 실패:", error);
            alert(`오류: ${error.message}`);
        }
    };

    onMounted(fetchCoupons);
    onUnmounted(() => {
      if (unsubscribe) unsubscribe();
    });

    return {
      coupons, isLoading, isUsing,
      formatCouponType, getCouponIcon, formatStatus, formatDate,
      useCoupon, deleteCoupon
    };
  }
};
</script>

<style scoped>
/* 전체적인 스타일은 유지하고, 쿠폰 카드 디자인을 전면 개편합니다. */
.my-events-page { padding: 20px; max-width: 1200px; margin: 70px auto; }
.page-header { text-align: center; margin-bottom: 30px; }
.page-header h1 { font-size: 2.5em; }
.content-wrapper { padding: 30px; }
.content-wrapper h2 { font-size: 1.8em; }
.loading-state, .empty-state { text-align: center; padding: 50px; }
.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 20px auto;
}
.coupon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 30px; }

/* 신규 쿠폰 카드 디자인 */
.coupon-card {
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}
.coupon-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 35px rgba(0,0,0,0.15);
}
.coupon-card.used, .coupon-card.expired {
  opacity: 0.6;
  filter: grayscale(80%);
}
.coupon-header {
  color: #fff;
  padding: 15px 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  border-radius: 15px 15px 0 0;
}
/* 쿠폰 종류별 색상 */
.type-SALT_MINE_BOOST .coupon-header { background: linear-gradient(135deg, #f39c12, #e67e22); }
.type-DEEP_SEA_AUTOSELL .coupon-header, .type-DEEP_SEA_GOLDENTIME .coupon-header,
.type-DEEP_SEA_RESEARCH .coupon-header, .type-DEEP_SEA_MINERAL .coupon-header,
.type-DEEP_SEA_PLANKTON .coupon-header, .type-DEEP_SEA_RELIC .coupon-header {
  background: linear-gradient(135deg, #3498db, #2980b9);
}
.type-SALTPANG_TIME_PLUS_5 .coupon-header, .type-SALTPANG_SCORE_X2_10S .coupon-header {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
}
.type-ITEM_RARE_SALT .coupon-header { background: linear-gradient(135deg, #9b59b6, #8e44ad); }

.coupon-main-icon { font-size: 1.6em; }
.coupon-title { font-size: 1.3em; font-weight: bold; }
.coupon-body { padding: 20px; flex-grow: 1; }
.coupon-body .description { font-style: italic; color: #777; margin-bottom: 15px; }
.details { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.details li { display: flex; align-items: center; gap: 10px; }
.details li i { color: #555; }
.coupon-footer {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9f9f9;
  border-radius: 0 0 15px 15px;
}
.coupon-expiry { font-size: 0.9em; color: #888; }

.button-group { display: flex; gap: 10px; }
.btn { border: none; border-radius: 8px; padding: 10px 15px; cursor: pointer; font-weight: bold; transition: all 0.2s ease; }
.btn-use { background-color: #28a745; color: white; }
.btn-use:disabled { background-color: #6c757d; cursor: not-allowed; }
.btn-delete { background-color: #dc3545; color: white; font-size: 0.9em; padding: 10px; }
.status-badge { /* ... 이전과 동일 ... */ }
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
.btn-use:hover:not(:disabled) {
  background-color: #218838;
  transform: translateY(-2px);
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
