<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3><i :class="headerIcon"></i> {{ headerTitle }} 내역</h3>
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
          <p>거래 내역이 없습니다.</p>
        </div>
        <ul v-else class="transaction-list">
          <li v-for="tx in transactions" :key="tx.id" class="transaction-item">
            <div class="tx-info">
              <span class="tx-description">{{ tx.description }}</span>
              <span class="tx-date">{{ formatDate(tx.timestamp) }}</span>
            </div>
            <div
              :class="['tx-amount', tx.amount > 0 ? 'positive' : 'negative']"
            >
              {{ formatAmount(tx.amount) }}
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { db, auth } from "@/firebaseConfig";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

export default {
  name: "TransactionHistoryModal",
  props: {
    balanceType: {
      type: String,
      required: true, // 'CASH' 또는 'SALTMATE'
    },
  },
  data() {
    return {
      transactions: [],
      isLoading: true,
      error: null,
    };
  },
  computed: {
    headerTitle() {
      return this.balanceType === "CASH" ? "현금성 수익" : "솔트메이트";
    },
    headerIcon() {
      return this.balanceType === "CASH" ? "fas fa-wallet" : "fas fa-gifts";
    },
  },
  async created() {
    await this.fetchTransactions();
  },
  methods: {
    async fetchTransactions() {
      this.isLoading = true;
      this.error = null;
      if (!auth.currentUser) {
        this.error = "사용자 인증 정보가 없습니다. 다시 로그인해주세요.";
        this.isLoading = false;
        return;
      }

      try {
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", auth.currentUser.uid),
          where("balanceType", "==", this.balanceType),
          orderBy("timestamp", "desc"),
        );
        const querySnapshot = await getDocs(q);
        this.transactions = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (e) {
        console.error("거래 내역 조회 중 오류 발생:", e);
        this.error = "내역을 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
    },
    formatDate(timestamp) {
      if (!timestamp || !timestamp.toDate) return "";
      return timestamp.toDate().toLocaleString("ko-KR");
    },
    formatAmount(amount) {
      const sign = amount > 0 ? "+" : "";
      const unit = this.balanceType === "CASH" ? "원" : "P";
      return `${sign}${amount.toLocaleString()} ${unit}`;
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
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
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
  padding: 40px 0;
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
  color: #007bff;
}
.tx-amount.negative {
  color: #dc3545;
}
</style>
