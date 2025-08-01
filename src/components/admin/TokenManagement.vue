<template>
  <div class="management-container">
    <h3><i class="fas fa-coins"></i> 토큰 관리 (COBS, BND)</h3>
    <p>토큰의 발행, 소각 및 유통 현황을 관리합니다.</p>

    <div class="token-summary card">
      <h4>토큰 현황</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <div v-else class="summary-grid">
        <div class="token-card cobs">
          <h5>COBS (보상 토큰)</h5>
          <p>총 발행량: {{ formatNumber(tokenData.cobs.totalSupply) }}</p>
          <p>총 소각량: {{ formatNumber(tokenData.cobs.totalBurned) }}</p>
          <p>
            현재 유통량: {{ formatNumber(tokenData.cobs.circulatingSupply) }}
          </p>
        </div>
        <div class="token-card bnd">
          <h5>BND (증권형 토큰)</h5>
          <p>총 발행량: {{ formatNumber(tokenData.bnd.totalSupply) }}</p>
          <p>총 소각량: {{ formatNumber(tokenData.bnd.totalBurned) }}</p>
          <p>
            현재 유통량: {{ formatNumber(tokenData.bnd.circulatingSupply) }}
          </p>
        </div>
      </div>
    </div>

    <div class="token-actions card">
      <h4>토큰 발행 / 소각</h4>
      <form @submit.prevent="handleAction">
        <div class="form-group-inline">
          <div class="form-group">
            <label>토큰 선택</label>
            <select v-model="action.token">
              <option value="cobs">COBS</option>
              <option value="bnd">BND</option>
            </select>
          </div>
          <div class="form-group">
            <label>작업 선택</label>
            <select v-model="action.type">
              <option value="mint">발행 (Mint)</option>
              <option value="burn">소각 (Burn)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="amount">수량</label>
            <input
              type="number"
              id="amount"
              v-model.number="action.amount"
              placeholder="수량 입력"
              min="0"
              required
            />
          </div>
        </div>
        <div class="form-group">
          <label for="reason">사유</label>
          <input
            type="text"
            id="reason"
            v-model="action.reason"
            placeholder="발행 또는 소각 사유 (예: 이벤트 보상)"
            required
          />
        </div>
        <button type="submit" class="btn btn-primary">작업 실행</button>
      </form>
    </div>

    <div class="transaction-log card">
      <h4>트랜잭션 기록</h4>
      <p class="placeholder-text">이곳에 토큰 발행/소각 기록이 표시됩니다.</p>
    </div>
  </div>
</template>

<script setup>
// 변경 후 (2개의 import 라인)
import { ref, reactive, onMounted } from "vue";
import { db, auth } from "@/firebaseConfig"; // auth 추가
import {
  doc,
  getDoc,
  collection, // collection 추가
  increment,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore"; // updateDoc 삭제

const loading = ref(true);
const tokenData = reactive({
  cobs: { totalSupply: 0, totalBurned: 0, circulatingSupply: 0 },
  bnd: { totalSupply: 0, totalBurned: 0, circulatingSupply: 0 },
});
const action = reactive({
  token: "cobs",
  type: "mint",
  amount: 0,
  reason: "",
});

// --- Helper Functions ---
const formatNumber = (value) =>
  new Intl.NumberFormat("ko-KR").format(value || 0);

// --- Firestore Functions ---
const fetchTokenData = async () => {
  loading.value = true;
  try {
    const tokenDocRef = doc(db, "tokenStats", "summary");
    const docSnap = await getDoc(tokenDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      Object.assign(tokenData.cobs, data.cobs);
      Object.assign(tokenData.bnd, data.bnd);
    } else {
      // 문서가 없으면 초기화
      console.log("토큰 요약 문서가 존재하지 않아 초기화합니다.");
    }
  } catch (error) {
    console.error("토큰 데이터를 불러오는 중 오류 발생:", error);
  } finally {
    loading.value = false;
  }
};

const handleAction = async () => {
  if (action.amount <= 0 || !action.reason.trim()) {
    alert("유효한 수량과 사유를 입력해주세요.");
    return;
  }

  const tokenName = action.token.toUpperCase();
  const actionTypeText = action.type === "mint" ? "발행" : "소각";

  if (
    !confirm(
      `${tokenName} 토큰 ${action.amount}개를 ${actionTypeText}하시겠습니까?`,
    )
  )
    return;

  const batch = writeBatch(db);
  const tokenSummaryRef = doc(db, "tokenStats", "summary");
  const logRef = doc(collection(db, "tokenTransactions")); // 새 로그 문서

  let updatePayload = {};

  if (action.type === "mint") {
    updatePayload[`${action.token}.totalSupply`] = increment(action.amount);
    updatePayload[`${action.token}.circulatingSupply`] = increment(
      action.amount,
    );
  } else {
    // burn
    if (tokenData[action.token].circulatingSupply < action.amount) {
      alert("소각하려는 수량이 현재 유통량보다 많습니다.");
      return;
    }
    updatePayload[`${action.token}.totalBurned`] = increment(action.amount);
    updatePayload[`${action.token}.circulatingSupply`] = increment(
      -action.amount,
    );
  }

  // 1. 요약 정보 업데이트
  batch.update(tokenSummaryRef, updatePayload);

  // 2. 트랜잭션 로그 기록
  batch.set(logRef, {
    token: action.token,
    type: action.type,
    amount: action.amount,
    reason: action.reason,
    createdAt: serverTimestamp(),
    adminId: auth.currentUser.uid, // 실행한 관리자 ID 기록
  });

  try {
    await batch.commit();
    alert(`작업이 성공적으로 완료되었습니다.`);
    action.amount = 0;
    action.reason = "";
    await fetchTokenData(); // 데이터 새로고침
  } catch (error) {
    console.error("토큰 작업 중 오류 발생:", error);
    alert("작업에 실패했습니다.");
  }
};

onMounted(fetchTokenData);
</script>

<style scoped>
.management-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.card {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3,
h4,
h5 {
  margin-top: 0;
}

/* 토큰 요약 */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.token-card {
  padding: 20px;
  border-radius: 8px;
  color: white;
}
.token-card h5 {
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  padding-bottom: 10px;
  margin-bottom: 15px;
}
.token-card p {
  font-size: 1.1em;
}
.cobs {
  background: linear-gradient(135deg, #2980b9, #3498db);
}
.bnd {
  background: linear-gradient(135deg, #8e44ad, #9b59b6);
}

/* 토큰 작업 폼 */
.token-actions .form-group-inline {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}
.token-actions .form-group {
  flex: 1;
}
.token-actions label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}
.token-actions input,
.token-actions select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  box-sizing: border-box;
}
.placeholder-text {
  color: #999;
  text-align: center;
  padding: 20px;
}

/* 공용 스타일 */
.btn-primary {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
}
.loading-spinner {
  /* ... 이전과 동일 ... */
}
</style>
