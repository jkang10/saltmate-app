<template>
  <div class="modal-overlay" @click.self="emits('close')">
    <div class="modal-content transaction-history-modal">
      <header class="modal-header">
        <h3>
          <i class="fas fa-history"></i> {{ user.name }}님의 SaltMate 내역
        </h3>
        <button @click="emits('close')" class="close-button">&times;</button>
      </header>
      <div class="modal-body">
        <div v-if="isLoading" class="loading-spinner"></div>
        <div v-else-if="error" class="error-state">{{ error }}</div>
        <div v-else-if="transactions.length === 0" class="empty-state">
          SaltMate 거래 내역이 없습니다.
        </div>
        <div v-else class="history-list-container">
          <ul class="history-list">
            <li v-for="tx in transactions" :key="tx.id" class="history-item">
              <span class="tx-date">{{ formatDate(tx.timestamp) }}</span>
              <span class="tx-description">{{ tx.description }}</span>
              <span
                class="tx-amount"
                :class="{
                  positive: tx.amount > 0,
                  negative: tx.amount < 0,
                }"
              >
                {{ (tx.amount > 0 ? "+" : "") + tx.amount.toLocaleString() }}
              </span>
            </li>
          </ul>
        </div>
      </div>
      <footer class="modal-footer">
        <div class="total-summary">
          <span>총 획득:</span>
          <strong class="positive">+{{ totalIncome.toLocaleString() }} P</strong>
        </div>
        <div class="total-summary">
          <span>총 사용:</span>
          <strong class="negative">{{ totalExpense.toLocaleString() }} P</strong>
        </div>
        <div class="total-summary net">
          <span>최종 합계:</span>
          <strong>{{ (totalIncome + totalExpense).toLocaleString() }} P</strong>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineProps, defineEmits } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";

const props = defineProps({
  user: { type: Object, required: true },
});
const emits = defineEmits(["close"]);

const transactions = ref([]);
const isLoading = ref(true);
const error = ref(null);

// SaltMate 내역만 필터링 (type: "SALTMATE")
const fetchHistory = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", props.user.uid),
      where("balanceType", "==", "SALTMATE"), // [핵심] SaltMate만 필터링
      orderBy("timestamp", "desc")
    );
    const querySnapshot = await getDocs(q);
    transactions.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error("SaltMate 내역 조회 실패:", err);
    error.value = "내역을 불러오는 데 실패했습니다.";
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return "날짜 없음";
  return timestamp.toDate().toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 총 획득 (양수만)
const totalIncome = computed(() => {
  return transactions.value
    .filter((tx) => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
});

// 총 사용 (음수만)
const totalExpense = computed(() => {
  return transactions.value
    .filter((tx) => tx.amount < 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
});

onMounted(() => {
  fetchHistory();
});
</script>

<style scoped>
/* (TransactionHistoryModal.vue 스타일과 유사하게 구성) */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
}
.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding: 1rem 1.5rem;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.3em;
  display: flex;
  align-items: center;
  gap: 10px;
}
.close-button {
  background: none;
  border: none;
  font-size: 2em;
  cursor: pointer;
  line-height: 1;
}
.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
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
  to { transform: rotate(360deg); }
}
.empty-state,
.error-state {
  text-align: center;
  padding: 50px;
  color: #777;
}
.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.history-item {
  display: grid;
  grid-template-columns: 130px 1fr auto;
  gap: 15px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.history-item:last-child {
  border-bottom: none;
}
.tx-date {
  font-size: 0.85em;
  color: #555;
}
.tx-description {
  font-size: 0.95em;
  color: #333;
  word-break: keep-all;
}
.tx-amount {
  font-weight: bold;
  font-size: 1.1em;
  text-align: right;
  white-space: nowrap;
}
.tx-amount.positive {
  color: #007bff;
}
.tx-amount.negative {
  color: #dc3545;
}

/* [신규] 하단 합계 스타일 */
.modal-footer {
  border-top: 1px solid #eee;
  padding: 1rem 1.5rem;
  background-color: #f8f9fa;
  display: flex;
  justify-content: space-around;
  gap: 15px;
}
.total-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.total-summary span {
  font-size: 0.9em;
  color: #555;
}
.total-summary strong {
  font-size: 1.25em;
}
.total-summary.net strong {
  font-size: 1.4em;
  color: #333;
}
.total-summary .positive {
  color: #007bff;
}
.total-summary .negative {
  color: #dc3545;
}
</style>