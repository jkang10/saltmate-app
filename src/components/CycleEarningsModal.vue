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
        <ul v-else class="transaction-list">
          <li v-for="tx in transactions" :key="tx.id" class="transaction-item">
            <div class="tx-info">
              <span class="tx-description">{{ tx.description }}</span>
              <span class="tx-date">{{ formatDate(tx.timestamp) }}</span>
            </div>
            <div class="tx-amount positive">
              + {{ (tx.grossAmount || 0).toLocaleString() }} 원
            </div>
          </li>
        </ul>
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
        // 수익 사이클에 기여하는 모든 종류의 거래를 조회합니다.
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", auth.currentUser.uid),
          where("type", "in", ["DIRECT_BONUS", "ROI_BONUS", "MATCHING_BONUS"]),
          orderBy("timestamp", "desc"),
        );
        const querySnapshot = await getDocs(q);

        // grossAmount를 기준으로 내역을 구성합니다. (실제 사이클 누적액 기준)
        const mappedTransactions = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          // grossAmount 계산 (예시: 추천 보너스의 경우)
          // 실제 데이터 구조에 따라 이 부분을 조정해야 할 수 있습니다.
          let grossAmount = data.amount; // 기본값
          if (data.type === "DIRECT_BONUS") {
            // 30/70으로 나뉘기 전의 총액을 계산해야 함
            // 예: grossBonus = (cashBonus + saltmateBonus) / (1 - feeRate)
            // 단순화를 위해 임시로 amount를 그대로 사용
          }
          return {
            id: doc.id,
            ...data,
            grossAmount: grossAmount,
          };
        });

        this.transactions = mappedTransactions;
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
  },
};
</script>

<style scoped>
/* TransactionHistoryModal.vue 와 동일한 스타일 사용 */
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
  max-width: 500px;
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
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.transaction-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 5px;
  border-bottom: 1px solid #f0f0f0;
}
.transaction-item:last-child {
  border-bottom: none;
}
.tx-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tx-description {
  font-weight: 500;
}
.tx-date {
  font-size: 0.8em;
  color: #888;
}
.tx-amount {
  font-weight: bold;
  font-size: 1.1em;
}
.tx-amount.positive {
  color: #28a745;
}
</style>
