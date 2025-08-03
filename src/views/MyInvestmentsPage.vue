<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-chart-line"></i> 내 수익 현황</h1>
      <p class="description">
        기간별, 유형별 수익 발생 내역을 상세히 확인합니다.
      </p>
    </header>

    <main class="content-wrapper card">
      <section class="filter-section">
        <div class="filter-buttons">
          <button
            @click="setFilterDays(7)"
            :class="{ active: activeFilter === 7 }"
          >
            최근 7일
          </button>
          <button
            @click="setFilterDays(30)"
            :class="{ active: activeFilter === 30 }"
          >
            최근 1개월
          </button>
          <button
            @click="setFilterDays(90)"
            :class="{ active: activeFilter === 90 }"
          >
            최근 3개월
          </button>
        </div>
      </section>

      <section class="summary-section">
        <div class="summary-card cash">
          <label>총 현금성 수익</label>
          <span>{{ summary.cash.toLocaleString() }} 원</span>
        </div>
        <div class="summary-card saltmate">
          <label>총 솔트메이트 수익</label>
          <span>{{ summary.saltmate.toLocaleString() }} P</span>
        </div>
      </section>

      <section class="details-section">
        <h3>상세 내역</h3>
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>데이터를 불러오는 중입니다...</p>
        </div>
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
        </div>
        <div v-else-if="transactions.length === 0" class="empty-state">
          <p>선택된 기간에 해당하는 수익 내역이 없습니다.</p>
        </div>
        <div v-else class="table-container">
          <table class="transaction-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>상세 내용</th>
                <th>구분</th>
                <th>금액</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in transactions" :key="tx.id">
                <td>{{ formatDate(tx.timestamp) }}</td>
                <td>{{ tx.description }}</td>
                <td>
                  <span
                    :class="[
                      'balance-type-badge',
                      tx.balanceType.toLowerCase(),
                    ]"
                    >{{ tx.balanceType === "CASH" ? "현금" : "SaltMate" }}</span
                  >
                </td>
                <td
                  :class="['amount', tx.amount > 0 ? 'positive' : 'negative']"
                >
                  {{ formatAmount(tx.amount, tx.balanceType) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { db, auth } from "@/firebaseConfig";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";

export default {
  name: "MyInvestmentsPage",
  data() {
    return {
      transactions: [],
      summary: {
        cash: 0,
        saltmate: 0,
      },
      isLoading: true,
      error: null,
      activeFilter: 30, // 기본값: 최근 1개월
    };
  },
  async created() {
    this.setFilterDays(this.activeFilter); // 컴포넌트 생성 시 기본 필터로 데이터 조회
  },
  methods: {
    async fetchTransactions(startDate, endDate) {
      this.isLoading = true;
      this.error = null;
      this.transactions = []; // 초기화

      if (!auth.currentUser) {
        this.error = "로그인이 필요합니다.";
        this.isLoading = false;
        return;
      }

      try {
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", auth.currentUser.uid),
          where("timestamp", ">=", startDate),
          where("timestamp", "<=", endDate),
          orderBy("timestamp", "desc"),
        );

        const querySnapshot = await getDocs(q);
        this.transactions = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        this.calculateSummary();
      } catch (e) {
        console.error("수익 내역 조회 오류:", e);
        if (e.code === "failed-precondition") {
          this.error =
            "데이터 조회를 위한 색인이 필요합니다. Firebase 콘솔에서 생성해주세요.";
        } else {
          this.error = "내역을 불러오는 데 실패했습니다.";
        }
      } finally {
        this.isLoading = false;
      }
    },
    calculateSummary() {
      const summaryData = this.transactions.reduce(
        (acc, tx) => {
          if (tx.amount > 0) {
            // 수익만 계산
            if (tx.balanceType === "CASH") {
              acc.cash += tx.amount;
            } else if (tx.balanceType === "SALTMATE") {
              acc.saltmate += tx.amount;
            }
          }
          return acc;
        },
        { cash: 0, saltmate: 0 },
      );
      this.summary = summaryData;
    },
    setFilterDays(days) {
      this.activeFilter = days;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      // Firestore Timestamp 객체로 변환
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      this.fetchTransactions(startTimestamp, endTimestamp);
    },
    formatDate(timestamp) {
      if (!timestamp || !timestamp.toDate) return "";
      return timestamp.toDate().toLocaleDateString("ko-KR");
    },
    formatAmount(amount, balanceType) {
      const sign = amount > 0 ? "+" : "";
      const unit = balanceType === "CASH" ? "원" : "SaltMate";
      return `${sign}${amount.toLocaleString()} ${unit}`;
    },
  },
};
</script>

<style scoped>
.page-container {
  padding: 20px;
  max-width: 1000px;
  margin: 70px auto 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.5em;
  color: #333;
  margin-bottom: 10px;
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.content-wrapper {
  padding: 30px;
}
.filter-section {
  margin-bottom: 30px;
}
.filter-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.filter-buttons button {
  background-color: #f0f2f5;
  border: 1px solid #ddd;
  color: #555;
  padding: 10px 20px;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}
.filter-buttons button:hover {
  background-color: #e2e6ea;
}
.filter-buttons button.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}
.summary-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 40px;
}
.summary-card {
  padding: 25px;
  border-radius: 12px;
  text-align: center;
  color: white;
}
.summary-card.cash {
  background: linear-gradient(135deg, #17a2b8, #20c997);
}
.summary-card.saltmate {
  background: linear-gradient(135deg, #6f42c1, #a96ef0);
}
.summary-card label {
  display: block;
  font-size: 1.1em;
  margin-bottom: 10px;
  opacity: 0.9;
}
.summary-card span {
  font-size: 2.2em;
  font-weight: bold;
}
.details-section h3 {
  font-size: 1.6em;
  margin-bottom: 20px;
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
}
.loading-state,
.empty-state,
.error-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
.spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.table-container {
  overflow-x: auto;
}
.transaction-table {
  width: 100%;
  border-collapse: collapse;
}
.transaction-table th,
.transaction-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}
.transaction-table thead th {
  background-color: #f8f9fa;
  font-weight: bold;
}
.transaction-table td:nth-child(1) {
  width: 20%;
}
.transaction-table td:nth-child(2) {
  width: 50%;
}
.transaction-table td:nth-child(3) {
  text-align: center;
}
.transaction-table td:nth-child(4) {
  text-align: right;
}

.balance-type-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
  color: white;
  font-size: 0.85em;
}
.balance-type-badge.cash {
  background-color: #17a2b8;
}
.balance-type-badge.saltmate {
  background-color: #6f42c1;
}

.amount {
  font-weight: bold;
}
.amount.positive {
  color: #007bff;
}
.amount.negative {
  color: #dc3545;
}
</style>
