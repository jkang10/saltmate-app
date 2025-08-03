<template>
  <div class="investment-management">
    <h3><i class="fas fa-hand-holding-usd"></i> 투자금 관리</h3>
    <p>전체 투자 현황을 요약하고, 입/출금 및 정산 처리를 관리합니다.</p>

    <div class="summary-cards">
      <div class="card">
        <h4>총 투자금액</h4>
        <p>{{ formatCurrency(summary.totalAmount) }}</p>
      </div>
      <div class="card">
        <h4>총 투자 건수</h4>
        <p>{{ summary.totalCount }} 건</p>
      </div>
      <div class="card">
        <h4>처리 완료 건수</h4>
        <p>{{ summary.completedCount }} 건</p>
      </div>
      <div class="card">
        <h4>입금 확인중 건수</h4>
        <p>{{ summary.pendingCount }} 건</p>
      </div>
    </div>

    <div v-if="loading" class="loading-spinner"></div>
    <table v-else-if="investments.length > 0" class="investment-table">
      <thead>
        <tr>
          <th>투자자 이름</th>
          <th>이메일</th>
          <th>투자 금액</th>
          <th>투자일</th>
          <th>상태</th>
          <th>관리</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="investment in investments" :key="investment.id">
          <td>{{ investment.userName || "정보 없음" }}</td>
          <td>{{ investment.userEmail || "정보 없음" }}</td>
          <td class="amount">{{ formatCurrency(investment.amount) }}</td>
          <td>{{ formatDate(investment.createdAt) }}</td>
          <td>
            <span :class="`status-badge status-${investment.status}`">
              {{ getStatusText(investment.status) }}
            </span>
          </td>
          <td>
            <button
              v-if="investment.status === 'pending'"
              @click="updateStatus(investment.id, 'completed')"
              class="btn btn-sm btn-success"
            >
              입금 확인
            </button>
            <button
              v-if="investment.status === 'completed'"
              @click="updateStatus(investment.id, 'pending')"
              class="btn btn-sm btn-warning"
            >
              확인 취소
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="no-data">투자 내역이 없습니다.</div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  orderBy,
  query,
  getDoc, // [수정] getDoc 추가
} from "firebase/firestore";

const investments = ref([]);
const loading = ref(true);
const summary = reactive({
  totalAmount: 0,
  totalCount: 0,
  completedCount: 0,
  pendingCount: 0,
});

// --- Helper Functions ---
const formatCurrency = (value) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(
    value || 0,
  );
const formatDate = (timestamp) => {
  if (!timestamp) return "";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};
const getStatusText = (status) => {
  const statusMap = {
    pending: "입금 확인중",
    completed: "처리 완료",
    cancelled: "취소",
  };
  return statusMap[status] || status;
};

// --- Firestore Functions ---

// ▼▼▼ [수정됨] 투자자 이름, 이메일을 함께 가져오도록 fetchInvestments 함수 전체 수정 ▼▼▼
const fetchInvestments = async () => {
  loading.value = true;
  try {
    const investmentsRef = collection(db, "investments");
    const q = query(investmentsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    const enrichedInvestments = await Promise.all(
      querySnapshot.docs.map(async (investmentDoc) => {
        const investmentData = {
          id: investmentDoc.id,
          ...investmentDoc.data(),
          // 기본값 설정
          userName: "N/A",
          userEmail: "N/A",
        };

        // userId가 있을 경우, users 컬렉션에서 해당 유저 정보 조회
        if (investmentData.userId) {
          const userRef = doc(db, "users", investmentData.userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            // 조회한 사용자 정보를 투자 데이터에 추가
            investmentData.userName = userSnap.data().name;
            investmentData.userEmail = userSnap.data().email;
          }
        }
        return investmentData;
      }),
    );

    investments.value = enrichedInvestments;
    calculateSummary();
  } catch (error) {
    console.error("투자 내역을 불러오는 중 오류 발생:", error);
    alert("투자 내역을 불러오는 데 실패했습니다.");
  } finally {
    loading.value = false;
  }
};
// ▲▲▲ 수정 완료 ▲▲▲

const calculateSummary = () => {
  summary.totalAmount = investments.value.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  summary.totalCount = investments.value.length;
  summary.completedCount = investments.value.filter(
    (item) => item.status === "completed",
  ).length;
  summary.pendingCount = investments.value.filter(
    (item) => item.status === "pending",
  ).length;
};

const updateStatus = async (id, newStatus) => {
  const statusText = getStatusText(newStatus);
  const confirmation = confirm(
    `이 투자 건의 상태를 '${statusText}' (으)로 변경하시겠습니까?`,
  );
  if (!confirmation) return;

  try {
    const investmentRef = doc(db, "investments", id);
    await updateDoc(investmentRef, { status: newStatus });

    const index = investments.value.findIndex((item) => item.id === id);
    if (index !== -1) {
      investments.value[index].status = newStatus;
    }
    calculateSummary();
    alert("상태가 성공적으로 변경되었습니다.");
  } catch (error) {
    console.error("상태 변경 중 오류 발생: ", error);
    alert("상태 변경에 실패했습니다.");
  }
};

onMounted(fetchInvestments);
</script>

<style scoped>
/* 기존 스타일과 동일 (변경 없음) */
.investment-management {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.investment-management h3 {
  margin-bottom: 20px;
}
.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}
.summary-cards .card {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}
.summary-cards .card h4 {
  margin-bottom: 10px;
  color: #555;
}
.summary-cards .card p {
  font-size: 1.5em;
  font-weight: bold;
  color: #333;
}
.investment-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.investment-table th,
.investment-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
  vertical-align: middle;
}
.investment-table th {
  background-color: #f8f9fa;
}
.investment-table .amount {
  font-weight: 600;
}
.status-badge {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: bold;
  color: #fff;
}
.status-pending {
  background-color: #ffc107; /* 주황색 */
}
.status-completed {
  background-color: #28a745; /* 초록색 */
}
.status-cancelled {
  background-color: #6c757d; /* 회색 */
}
.btn {
  border: none;
  border-radius: 5px;
  padding: 6px 12px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn:hover {
  opacity: 0.8;
}
.btn-success {
  background-color: #28a745;
  color: white;
}
.btn-warning {
  background-color: #ffc107;
  color: #212529;
}
.loading-spinner,
.no-data {
  text-align: center;
  padding: 50px;
  color: #777;
}
.loading-spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #007bff;
  animation: spin 1s ease infinite;
  margin: 50px auto;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
