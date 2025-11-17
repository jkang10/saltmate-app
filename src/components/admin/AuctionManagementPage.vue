<template>
  <div class="auction-management">
    <h3><i class="fas fa-gavel"></i> 주간 경매 관리</h3>
    <p>현재 진행 중인 경매를 확인하고, 다음 주에 진행될 경매의 상품을 설정합니다.</p>

    <div class="card current-auction">
      <h4><i class="fas fa-play-circle"></i> 현재 진행 중인 경매 (읽기 전용)</h4>
      <div v-if="isLoadingCurrent" class="loading-spinner"></div>
      <div v-else-if="currentAuction">
        <div class="form-group">
          <label>상품 이름</label>
          <input type="text" :value="currentAuction.prizeName" disabled>
        </div>
        <div class="form-group">
          <label>상품 설명</label>
          <textarea :value="currentAuction.prizeDescription" rows="2" disabled></textarea>
        </div>
        <div class="form-group-inline">
          <div class="form-group">
            <label>쿠폰 종류</label>
            <input type="text" :value="currentAuction.couponType" disabled>
          </div>
          <div class="form-group">
            <label>현재 최고가</label>
            <input type="text" :value="(currentAuction.highestBid || 0).toLocaleString() + ' SaltMate'" disabled>
          </div>
        </div>
      </div>
      <p v-else class="no-data">현재 진행 중인 경매가 없습니다.</p>
    </div>

    <div class="card next-auction">
      <h4><i class="fas fa-edit"></i> 다음 주 경매 상품 설정</h4>
      <p style="margin-top:-10px; margin-bottom: 20px; font-size: 0.9em; color: #555;">
        (저장 즉시 사용자 페이지의 '다음 경매' 예고편에 반영됩니다.)
      </p>
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
        <div class="form-group-inline">
            <div class="form-group" v-if="requiresQuantity">
                <label>지급 수량 (개)</label>
                <input type="number" v-model.number="nextAuction.couponDetails.quantity" required min="1" />
            </div>
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

    <div class="card manual-create">
      <h4><i class="fas fa-exclamation-triangle"></i> 비상시 수동 작업</h4>
      <p>
        매주 월요일 00:30에 경매가 자동으로 시작되지 않았을 경우,
        아래 버튼을 눌러 '이번 주' 경매를 수동으로 생성할 수 있습니다.
      </p>
      <button @click="callManualCreate" class="btn btn-danger" :disabled="isCreatingManually">
        <span v-if="isCreatingManually" class="spinner-small"></span>
        <span v-else>이번 주 경매 지금 생성하기</span>
      </button>

      <hr style="margin: 20px 0;">
      <p>
        월요일 00:05~00:20에 랭킹이 집계되지 않았을 경우, <strong>'지난주 월요일' 날짜</strong>를 입력하고
        수동으로 집계할 수 있습니다. (예: 오늘이 11월 17일이면 <strong>2025-11-10</strong> 입력)
      </p>
      <div class="form-group-inline">
        <div class="form-group">
            <label>집계할 주차 ID (지난주 월요일)</label>
            <input type="text" v-model="manualWeekId" placeholder="YYYY-MM-DD" />
        </div>
        <button @click="callManualGoldRank" class="btn btn-warning" :disabled="!manualWeekId || isCreatingManually">
          '주간 GOLD' 랭킹 집계
        </button>
        <button @click="callManualAlchemyRank" class="btn btn-warning" :disabled="!manualWeekId || isCreatingManually">
          '알케미' 랭킹 집계
        </button>
      </div>
      </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { db, functions } from '@/firebaseConfig'; // [수정] functions 임포트 확인
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'; 
import { httpsCallable } from 'firebase/functions'; // [★신규★]

// [★신규★] 수동 생성 함수 정의
const manualCreateFunc = httpsCallable(functions, 'manuallyCreateAuction');
// ▼▼▼ [★신규 추가★] ▼▼▼
const manualGoldRankFunc = httpsCallable(functions, 'manuallyCalculateGoldWinners');
const manualAlchemyRankFunc = httpsCallable(functions, 'manuallyCalculateAlchemyWinners');
const manualWeekId = ref(''); // 수동 집계를 위한 weekId
// ▲▲▲ (추가 완료) ▲▲▲

const isCreatingManually = ref(false);

const isSaving = ref(false);
const isLoadingCurrent = ref(true); // [신규 추가]
const currentAuction = ref(null); // [신규 추가]

const callManualCreate = async () => {
  if (!confirm("지난 스케줄이 실패한 경우에만 사용하세요.\n지금 즉시 '이번 주' 경매를 생성하시겠습니까?")) return;
  
  isCreatingManually.value = true;
  try {
    const result = await manualCreateFunc();
    alert(`성공: ${result.data.message}`);
    // 성공 시 '현재 진행 중인 경매' 컴포넌트가 자동으로 새로고침됩니다.
  } catch (error) {
    console.error("수동 경매 생성 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isCreatingManually.value = false;
  }
};

// ▼▼▼ [★신규 추가★] 수동 랭킹 집계 함수 ▼▼▼
const callManualGoldRank = async () => {
  if (!manualWeekId.value) return alert("지난주 월요일 날짜(YYYY-MM-DD)를 입력하세요.");
  if (!confirm(`'${manualWeekId.value}' 주차의 '주간 GOLD 수익 랭킹'을 지금 집계하시겠습니까?`)) return;

  isCreatingManually.value = true;
  try {
    const result = await manualGoldRankFunc({ weekId: manualWeekId.value });
    alert(`성공: ${result.data.message}`);
  } catch (error) {
    console.error("GOLD 랭킹 수동 집계 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isCreatingManually.value = false;
  }
};

const callManualAlchemyRank = async () => {
  if (!manualWeekId.value) return alert("지난주 월요일 날짜(YYYY-MM-DD)를 입력하세요.");
  if (!confirm(`'${manualWeekId.value}' 주차의 '솔트 알케미 랭킹'을 지금 집계하시겠습니까?`)) return;

  isCreatingManually.value = true;
  try {
    const result = await manualAlchemyRankFunc({ weekId: manualWeekId.value });
    alert(`성공: ${result.data.message}`);
  } catch (error) {
    console.error("알케미 랭킹 수동 집계 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isCreatingManually.value = false;
  }
};
// ▲▲▲ (추가 완료) ▲▲▲


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
    // (쿠폰 타입 목록은 기존과 동일)
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

// [신규 추가] 현재 KST 기준 주간 ID 계산
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

// (이하 로직은 기존과 동일)
watch(() => nextAuction.couponType, () => {
  nextAuction.couponDetails = {
    boostPercentage: null,
    durationMinutes: null,
    quantity: null,
  };
});

const requiresQuantity = computed(() => {
    const types = [
        'SALT_MINE_BOOST', 'DEEP_SEA_AUTOSELL', 'DEEP_SEA_GOLDENTIME',
        'SALTPANG_TIME_PLUS_5', 'SALTPANG_SCORE_X2_10S', 'ITEM_RARE_SALT', 
        'DEEP_SEA_RESEARCH', 'DEEP_SEA_MINERAL', 'DEEP_SEA_PLANKTON', 'DEEP_SEA_RELIC'
    ];
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

const fetchCurrentAuction = () => {
  const weekId = getWeekId();
  const auctionRef = doc(db, "auctions", weekId);
  
  onSnapshot(auctionRef, (docSnap) => {
    if (docSnap.exists() && docSnap.data().status === 'active') {
      currentAuction.value = docSnap.data();
    } else {
      currentAuction.value = null;
    }
    isLoadingCurrent.value = false;
  }, (error) => {
    console.error("현재 경매 정보 로딩 실패:", error);
    isLoadingCurrent.value = false;
  });
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

onMounted(() => {
  fetchNextAuction();
  fetchCurrentAuction(); 
});
</script>

<style scoped>
/* (EventManagement.vue의 스타일과 유사한 스타일을 사용합니다) */
.auction-management { display: flex; flex-direction: column; gap: 30px; }
.card { background-color: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); }
h3, h4 { margin-top: 0; }
h4 { display: flex; align-items: center; gap: 10px; font-size: 1.3rem; }
.card.current-auction h4 { color: #28a745; }
.card.next-auction h4 { color: #007bff; }
.form-group { margin-bottom: 20px; }
.form-group-inline { display: flex; gap: 20px; margin-bottom: 20px; align-items: flex-end; } /* [수정] align-items: flex-end 추가 */
.form-group-inline .form-group { flex: 1; margin-bottom: 0; }
label { display: block; margin-bottom: 8px; font-weight: 600; }
input, select, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 1em; box-sizing: border-box; }
input:disabled, textarea:disabled { background-color: #e9ecef; cursor: not-allowed; }
.btn-primary { background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
.no-data { color: #777; font-style: italic; }
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
.spinner-small { border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

/* [★신규★] 수동 생성 버튼 스타일 */
.btn-danger {
  background-color: #dc3545;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: background-color 0.2s ease;
}
.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}
.btn-danger:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}
.card.manual-create {
  border: 2px solid #dc3545;
}
.card.manual-create h4 {
  color: #dc3545;
}

/* [★신규★] 경고 버튼 스타일 (수동 집계용) */
.btn-warning {
  background-color: #ffc107;
  color: #212529;
  padding: 10px 15px; /* [수정] 패딩 조정 */
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: background-color 0.2s ease;
  height: 40px; /* [추가] 높이 고정 */
}
.btn-warning:hover:not(:disabled) {
  background-color: #e0a800;
}
.btn-warning:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}
</style>