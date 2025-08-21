<template>
  <div class="management-page">
    <h3><i class="fas fa-truck"></i> 주문 배송관리</h3>
    <p>상품 주문 내역을 확인하고 배송 상태를 관리합니다.</p>

    <div class="filter-tabs">
      <button
        @click="setFilter('all')"
        :class="{ active: activeFilter === 'all' }"
      >
        전체
      </button>
      <button
        @click="setFilter('paid')"
        :class="{ active: activeFilter === 'paid' }"
      >
        배송준비
      </button>
      <button
        @click="setFilter('shipped')"
        :class="{ active: activeFilter === 'shipped' }"
      >
        배송완료
      </button>
      <button
        @click="setFilter('cancelled')"
        :class="{ active: activeFilter === 'cancelled' }"
      >
        주문취소
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>주문일시</th>
            <th>주문자</th>
            <th>총 주문금액</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.id">
            <td>{{ formatDate(order.createdAt) }}</td>
            <td>{{ order.userName }}</td>
            <td>{{ (order.totalPrice || 0).toLocaleString() }} P</td>
            <td>
              <span :class="['status-badge', order.status]">{{
                formatStatus(order.status)
              }}</span>
            </td>
            <td class="actions">
              <button
                @click="openOrderDetails(order)"
                class="btn-secondary btn-sm"
              >
                상세보기
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <OrderDetailsModal
      v-if="selectedOrder"
      :order="selectedOrder"
      @close="selectedOrder = null"
      @order-updated="handleOrderUpdate"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { db } from "@/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import OrderDetailsModal from "./OrderDetailsModal.vue";

const allOrders = ref([]);
const isLoading = ref(true);
const activeFilter = ref("all");
const selectedOrder = ref(null);

const filteredOrders = computed(() => {
  if (activeFilter.value === "all") {
    return allOrders.value;
  }
  return allOrders.value.filter((order) => order.status === activeFilter.value);
});

const fetchOrders = async () => {
  isLoading.value = true;
  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    allOrders.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("주문 목록 조회 오류:", error);
  } finally {
    isLoading.value = false;
  }
};

const setFilter = (status) => {
  activeFilter.value = status;
};

const formatDate = (timestamp) => {
  return timestamp?.toDate().toLocaleString("ko-KR") || "";
};

const formatStatus = (status) => {
  const map = {
    pending: "결제대기",
    paid: "배송준비",
    shipped: "배송완료",
    cancelled: "주문취소",
  };
  return map[status] || status;
};

const openOrderDetails = (order) => {
  selectedOrder.value = order;
};

const handleOrderUpdate = () => {
  selectedOrder.value = null;
  fetchOrders();
};

onMounted(fetchOrders);
</script>

<style scoped>
.management-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}
.filter-tabs button {
  background-color: #fff;
  border: 1px solid #ddd;
  color: #555;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}
.filter-tabs button:hover {
  background-color: #e2e6ea;
}
.filter-tabs button.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}
.table-container {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}
th,
td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}
thead th {
  background-color: #f8f9fa;
}
.status-badge {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.85em;
  font-weight: bold;
  color: #fff;
}
.status-badge.pending {
  background-color: #ffc107;
  color: #333;
}
.status-badge.paid {
  background-color: #007bff;
}
.status-badge.shipped {
  background-color: #28a745;
}
.status-badge.cancelled {
  background-color: #6c757d;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.9em;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
.loading-state {
  text-align: center;
  padding: 40px;
}
.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  animation: spin 1s linear infinite;
  margin: auto;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
