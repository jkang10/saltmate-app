<template>
  <div class="auction-management">
    <h3><i class="fas fa-gavel"></i> 주간 경매 관리</h3>
    <p>다음 주에 진행될 경매의 상품을 설정합니다. 설정된 내용은 다음 주 월요일 00:30에 자동으로 반영됩니다.</p>

    <div class="card">
      <h4>다음 주 경매 상품 설정</h4>
      <form @submit.prevent="saveNextAuction">
        <div class="form-group">
          <label for="prize-name">상품 이름</label>
          <input id="prize-name" type="text" v-model="nextAuction.prizeName" placeholder="예: 희귀 소금 결정 x5" required>
        </div>
        <div class="form-group">
          <label for="prize-desc">상품 설명</label>
          <textarea id="prize-desc" v-model="nextAuction.prizeDescription" rows="3" required></textarea>
        </div>
        <div class="form-group">
          <label for="coupon-type">연결 쿠폰 종류 (낙찰자에게 지급)</label>
          <select id="coupon-type" v-model="nextAuction.couponType" required>
            <option disabled value="">-- 쿠폰 종류 선택 --</option>
            <option v-for="coupon in couponTypes" :key="coupon.id" :value="coupon.id">{{ coupon.name }}</option>
          </select>
        </div>

        <div class="form-group-inline" v-if="nextAuction.couponType === 'SALT_MINE_BOOST'">
            <div class="form-group">
                <label>부스트 비율 (%)</label>
                <input type="number" v-model.number="nextAuction.couponDetails.boostPercentage" required min="1" />
            </div>
            <div class="form-group">
                <label>지속 시간 (분)</label>
                <input type="number" v-model.number="nextAuction.couponDetails.durationMinutes" required min="1" />
            </div>
        </div>
        <div class="form-group" v-if="requiresQuantity">
            <label>지급 수량 (개)</label>
            <input type="number" v-model.number="nextAuction.couponDetails.quantity" required min="1" />
        </div>
         <div class="form-group" v-if="requiresDuration">
            <label>지속 시간 (분)</label>
            <input type="number" v-model.number="nextAuction.couponDetails.durationMinutes" required min="1" />
        </div>

        <button type="submit" class="btn btn-primary" :disabled="isSaving">
          <span v-if="isSaving" class="spinner-small"></span>
          <span v-else>다음 주 경매 설정 저장</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'; // watch를 import에 추가
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const isSaving = ref(false);
const nextAuction = reactive({
  prizeName: '',
  prizeDescription: '',
  couponType: '',
  couponDetails: {
    boostPercentage: null,
    durationMinutes: null,
    quantity: null,
  }
});

const couponTypes = ref([
    { id: 'SALT_MINE_BOOST', name: '소금 광산 채굴 부스트' },
    { id: 'DEEP_SEA_AUTOSELL', name: '심해 해구 자동판매' },
    { id: 'SALTPANG_TIME_PLUS_5', name: '솔트팡 +5초 시간 추가' },
    { id: 'SALTPANG_SCORE_X2_10S', name: '솔트팡 10초간 점수 2배' },
    { id: 'ITEM_RARE_SALT', name: '희귀 소금 결정' },
    { id: 'DEEP_SEA_RESEARCH', name: '해양심층수 연구 데이터' },
    { id: 'DEEP_SEA_MINERAL', name: '해양심층수 희귀 미네랄' },
    { id: 'DEEP_SEA_PLANKTON', name: '해양심층수 플랑크톤' },
    { id: 'DEEP_SEA_RELIC', name: '해양심층수 고대유물' },
    { id: 'DEEP_SEA_GOLDENTIME', name: '해양심층수 골든타임' },
]);

watch(() => nextAuction.couponType, (newType) => {
  // 쿠폰 종류가 변경되면 세부사항을 초기화합니다.
  nextAuction.couponDetails = {
    boostPercentage: null,
    durationMinutes: null,
    quantity: null,
  };
});

// 기존 requiresQuantity computed 속성을 아래 코드로 교체해주세요.
const requiresQuantity = computed(() => {
    const types = ['SALTPANG_TIME_PLUS_5', 'SALTPANG_SCORE_X2_10S', 'ITEM_RARE_SALT', 'DEEP_SEA_RESEARCH', 'DEEP_SEA_MINERAL', 'DEEP_SEA_PLANKTON', 'DEEP_SEA_RELIC'];
    return types.includes(nextAuction.couponType);
});

const requiresDuration = computed(() => {
    const types = ['DEEP_SEA_AUTOSELL', 'DEEP_SEA_GOLDENTIME'];
    return types.includes(nextAuction.couponType);
});

const fetchNextAuction = async () => {
  const docRef = doc(db, "configuration", "nextAuctionSetting");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    Object.assign(nextAuction, docSnap.data());
  }
};

const saveNextAuction = async () => {
  if (!confirm("다음 주 경매 설정을 저장하시겠습니까?")) return;
  isSaving.value = true;
  try {
    const docRef = doc(db, "configuration", "nextAuctionSetting");
    await setDoc(docRef, { 
        prizeName: nextAuction.prizeName,
        prizeDescription: nextAuction.prizeDescription,
        couponType: nextAuction.couponType,
        couponDetails: nextAuction.couponDetails
    });
    alert("설정이 저장되었습니다. 다음 주 월요일에 자동으로 반영됩니다.");
  } catch (error) {
    console.error("경매 설정 저장 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
};

onMounted(fetchNextAuction);
</script>

<style scoped>
/* (EventManagement.vue의 스타일과 유사한 스타일을 사용합니다) */
.auction-management { display: flex; flex-direction: column; gap: 30px; }
.card { background-color: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
h3, h4 { margin-top: 0; }
.form-group { margin-bottom: 20px; }
.form-group-inline { display: flex; gap: 20px; margin-bottom: 20px; }
.form-group-inline .form-group { flex: 1; margin-bottom: 0; }
label { display: block; margin-bottom: 8px; font-weight: 600; }
input, select, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 1em; box-sizing: border-box; }
.btn-primary { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
.spinner-small { border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>