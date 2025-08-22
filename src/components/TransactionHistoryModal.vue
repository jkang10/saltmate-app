<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <header class="modal-header">
        <h3>
          {{ title }}
          <span v-if="currentBalance !== null" class="current-balance">
            (현재 잔액: {{ currentBalance.toLocaleString() }}
            {{ balanceType === "CASH" ? "원" : "SaltMate" }})
          </span>
        </h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>
      <div class="modal-body">
        <div v-if="isLoading" class="loading-state">... 로딩 중 ...</div>
        <div v-else-if="transactions.length === 0" class="empty-state">
          거래 내역이 없습니다.
        </div>
        <ul v-else class="transaction-list">
          <li
            v-for="tx in transactions"
            :key="tx.id"
            :class="tx.amount > 0 ? 'income' : 'expense'"
          >
            <div class="tx-info">
              <span class="tx-description">{{ tx.description }}</span>
              <small class="tx-date">{{ formatDate(tx.timestamp) }}</small>
            </div>
            <div class="tx-amount">
              {{ tx.amount.toLocaleString()
              }}{{ balanceType === "CASH" ? " 원" : "" }}
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, computed } from "vue";
import { db, auth } from "@/firebaseConfig";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

// ▼▼▼ [수정] currentBalance prop 추가 ▼▼▼
const props = defineProps({
  balanceType: { type: String, required: true },
  currentBalance: { type: Number, default: null },
});
// ▲▲▲ 수정 완료 ▲▲▲

const transactions = ref([]);
const isLoading = ref(true);

const title = computed(() => {
  return props.balanceType === "CASH" ? "현금성 수익 내역" : "솔트메이트 내역";
});

const fetchTransactions = async () => {
  if (!auth.currentUser) return;
  isLoading.value = true;
  try {
    const q = query(
      collection(db, "transactions"),
      where("userId", "==", auth.currentUser.uid),
      where("balanceType", "==", props.balanceType),
      orderBy("timestamp", "desc"),
    );
    const querySnapshot = await getDocs(q);
    transactions.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("거래 내역 조회 오류:", error);
  } finally {
    isLoading.value = false;
  }
};

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

onMounted(fetchTransactions);
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: #fff;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
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
  font-size: 1.2em;
}
.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}
.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}
.loading-state,
.empty-state {
  text-align: center;
  padding: 30px;
  color: #888;
}
.transaction-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.transaction-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.transaction-list li:last-child {
  border-bottom: none;
}
.tx-info {
  display: flex;
  flex-direction: column;
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
.income .tx-amount {
  color: #007bff;
}
.expense .tx-amount {
  color: #dc3545;
}
/* ▼▼▼ [신규 추가] 현재 잔액 스타일 ▼▼▼ */
.current-balance {
  font-size: 0.8em;
  font-weight: normal;
  color: #555;
  margin-left: 10px;
}
/* ▲▲▲ 신규 추가 완료 ▲▲▲ */
</style>
