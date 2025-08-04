<template>
  <div class="token-management">
    <h3><i class="fas fa-coins"></i> 토큰 관리 (COBS, BND)</h3>
    <p>토큰의 발행, 소각 및 유통 현황을 관리합니다.</p>

    <section class="card summary-section">
      <h4>토큰 현황</h4>
      <div class="summary-grid">
        <div class="token-card cobs">
          <h5>COBS (보상 토큰)</h5>
          <p>
            총 발행량:
            <span>{{
              (tokenomics.COBS?.totalSupply || 0).toLocaleString()
            }}</span>
          </p>
          <p>
            총 소각량:
            <span>{{
              (tokenomics.COBS?.totalBurned || 0).toLocaleString()
            }}</span>
          </p>
          <hr />
          <p>
            현재 유통량:
            <strong>{{
              (
                (tokenomics.COBS?.totalSupply || 0) -
                (tokenomics.COBS?.totalBurned || 0)
              ).toLocaleString()
            }}</strong>
          </p>
        </div>
        <div class="token-card bnd">
          <h5>BND (증권형 토큰)</h5>
          <p>
            총 발행량:
            <span>{{
              (tokenomics.BND?.totalSupply || 0).toLocaleString()
            }}</span>
          </p>
          <p>
            총 소각량:
            <span>{{
              (tokenomics.BND?.totalBurned || 0).toLocaleString()
            }}</span>
          </p>
          <hr />
          <p>
            현재 유통량:
            <strong>{{
              (
                (tokenomics.BND?.totalSupply || 0) -
                (tokenomics.BND?.totalBurned || 0)
              ).toLocaleString()
            }}</strong>
          </p>
        </div>
      </div>
    </section>

    <section class="card action-section">
      <h4>토큰 발행 / 소각</h4>
      <form @submit.prevent="executeTokenAction">
        <div class="form-row">
          <div class="form-group">
            <label>토큰 선택</label>
            <select v-model="actionForm.tokenType">
              <option value="COBS">COBS</option>
              <option value="BND">BND</option>
            </select>
          </div>
          <div class="form-group">
            <label>작업 선택</label>
            <select v-model="actionForm.actionType">
              <option value="mint">발행 (Mint)</option>
              <option value="burn">소각 (Burn)</option>
            </select>
          </div>
          <div class="form-group">
            <label>수량</label>
            <input
              type="number"
              v-model.number="actionForm.quantity"
              min="1"
              placeholder="1 이상 숫자 입력"
              required
            />
          </div>
        </div>
        <div class="form-group">
          <label>사유</label>
          <input
            type="text"
            v-model="actionForm.reason"
            placeholder="작업 사유를 입력하세요 (예: 초기 발행)"
            required
          />
        </div>
        <button type="submit" :disabled="isProcessing" class="btn-primary">
          <span v-if="isProcessing">처리 중...</span>
          <span v-else>작업 실행</span>
        </button>
      </form>
    </section>

    <section class="card user-holdings-section">
      <h4>회원별 토큰 보유 현황</h4>
      <div v-if="isLoadingUsers" class="loading-state">
        <div class="spinner"></div>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>COBS 보유량</th>
              <th>BND 보유량</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in userList" :key="user.id">
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>{{ (user.tokens?.cobs || 0).toLocaleString() }}</td>
              <td>{{ (user.tokens?.bnd || 0).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { db } from "@/firebaseConfig";
import { doc, collection, onSnapshot, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const tokenomics = ref({});
const actionForm = reactive({
  tokenType: "COBS",
  actionType: "mint",
  quantity: null,
  reason: "",
});
const isProcessing = ref(false);

const userList = ref([]);
const isLoadingUsers = ref(true);

// 토큰 현황 실시간 구독
onMounted(() => {
  const tokenomicsRef = doc(db, "configuration", "tokenomics");
  onSnapshot(tokenomicsRef, (docSnap) => {
    if (docSnap.exists()) {
      tokenomics.value = docSnap.data();
    }
  });

  fetchUserTokens();
});

const fetchUserTokens = async () => {
  isLoadingUsers.value = true;
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    userList.value = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("회원 토큰 정보 조회 오류:", error);
  } finally {
    isLoadingUsers.value = false;
  }
};

const executeTokenAction = async () => {
  if (!actionForm.quantity || !actionForm.reason) {
    alert("수량과 사유를 모두 입력해주세요.");
    return;
  }
  if (
    !confirm(
      `${actionForm.tokenType} 토큰을 ${actionForm.quantity.toLocaleString()}개 ${actionForm.actionType === "mint" ? "발행" : "소각"}하시겠습니까?`,
    )
  )
    return;

  isProcessing.value = true;
  try {
    const functions = getFunctions();
    const updateTokenSupply = httpsCallable(functions, "updateTokenSupply");
    const result = await updateTokenSupply({
      tokenType: actionForm.tokenType,
      actionType: actionForm.actionType,
      quantity: actionForm.quantity,
      reason: actionForm.reason,
    });
    alert(result.data.message);
    actionForm.quantity = null;
    actionForm.reason = "";
  } catch (error) {
    console.error("토큰 작업 실패:", error);
    alert(`작업에 실패했습니다: ${error.message}`);
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style scoped>
/* 페이지 및 카드 공통 스타일 */
.token-management {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3,
h4 {
  margin-top: 0;
}

/* 요약 섹션 */
.summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.token-card {
  padding: 20px;
  border-radius: 10px;
  color: white;
}
.token-card.cobs {
  background: linear-gradient(135deg, #007bff, #0056b3);
}
.token-card.bnd {
  background: linear-gradient(135deg, #6f42c1, #483d8b);
}
.token-card h5 {
  margin: 0 0 15px 0;
  font-size: 1.2em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  padding-bottom: 10px;
}
.token-card p {
  margin: 5px 0;
}
.token-card hr {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
  margin: 10px 0;
}
.token-card strong {
  font-size: 1.5em;
}

/* 작업 섹션 */
.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 20px;
  margin-bottom: 15px;
}
.form-group {
  display: flex;
  flex-direction: column;
}
.form-group label {
  font-weight: bold;
  margin-bottom: 5px;
  font-size: 0.9em;
}
.form-group input,
.form-group select {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.btn-primary {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.btn-primary:disabled {
  background-color: #a0c9ff;
  cursor: not-allowed;
}

/* 회원 보유 현황 */
.table-container {
  max-height: 400px;
  overflow-y: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 10px;
  border-bottom: 1px solid #eee;
  text-align: left;
}
thead th {
  background-color: #f8f9fa;
}
.loading-state {
  text-align: center;
  padding: 20px;
}
.spinner {
  /* 로딩 스피너 스타일 */
}
</style>
