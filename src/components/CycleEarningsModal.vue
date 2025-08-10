<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3><i class="fas fa-history"></i> 수익 사이클 누적 내역</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>
      <div class="modal-body">
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>내역을 불러오는 중입니다...</p>
        </div>
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
        </div>
        <div v-else-if="transactions.length === 0" class="empty-state">
          <p>수익 사이클에 누적된 내역이 없습니다.</p>
        </div>
        <div v-else class="table-container">
          <table class="transaction-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>상세 내용</th>
                <th>구분</th>
                <th>누적 금액 (수수료 차감 전)</th>
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
                  >
                    {{ formatBalanceType(tx.balanceType) }}
                  </span>
                </td>
                <td class="amount positive">
                  + {{ getGrossAmount(tx).toLocaleString() }} 원
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { auth, db } from "@/firebaseConfig";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

export default {
  name: "CycleEarningsModal",
  emits: ["close"],
  data() {
    return {
      transactions: [],
      isLoading: true,
      error: null,
    };
  },
  async created() {
    await this.fetchCycleTransactions();
  },
  methods: {
    async fetchCycleTransactions() {
      this.isLoading = true;
      this.error = null;
      if (!auth.currentUser) {
        this.error = "로그인이 필요합니다.";
        this.isLoading = false;
        return;
      }

      try {
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", auth.currentUser.uid),
          where("type", "in", ["DIRECT_BONUS", "ROI_BONUS", "MATCHING_BONUS"]),
          orderBy("timestamp", "desc"),
        );
        const querySnapshot = await getDocs(q);
        this.transactions = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        console.error("수익 사이클 내역 조회 오류:", e);
        this.error = "내역을 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
    },
    formatDate(timestamp) {
      if (!timestamp || !timestamp.toDate) return "";
      return timestamp.toDate().toLocaleString("ko-KR");
    },
    getGrossAmount(transaction) {
      // 사이클 누적액은 수수료(5%) 차감 전 금액(Gross) 기준입니다.
      // 현재 amount는 수수료 차감 후 30/70으로 나뉜 금액이므로, 원래 총액을 역산합니다.
      const feeRate = 0.05;
      if (
        transaction.type === "DIRECT_BONUS" ||
        transaction.type === "ROI_BONUS"
      ) {
        // 현금과 Saltmate로 나뉘기 전의 총액
        return (
          transaction.amount /
          ((transaction.balanceType === "CASH" ? 0.3 : 0.7) * (1 - feeRate))
        );
      }
      // 매칭 보너스는 100% Saltmate로 지급되므로 역산 방식이 다릅니다.
      if (transaction.type === "MATCHING_BONUS") {
        return transaction.amount / (1 - feeRate);
      }
      return transaction.amount; // 기타 경우는 일단 그대로 표시
    },
    formatBalanceType(type) {
      const typeMap = {
        CASH: "현금",
        SALTMATE: "SaltMate",
      };
      return typeMap[type] || type;
    },
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  width: 90%;
  max-width: 700px; /* 가로 사이즈 확장 */
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.4em;
  display: flex;
  align-items: center;
  gap: 10px;
}
.close-button {
  background: none;
  border: none;
  font-size: 2em;
  cursor: pointer;
  color: #888;
}
.modal-body {
  padding: 20px;
  overflow-y: auto;
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
  margin-bottom: 15px;
}
.table-container {
  max-height: 500px;
  overflow-y: auto;
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
  text-align: right;
}
.amount.positive {
  color: #28a745;
}
</style>
