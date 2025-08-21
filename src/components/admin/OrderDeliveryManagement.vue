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

<script>
import { db } from "@/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
// ▼▼▼ [신규 추가] 모달 컴포넌트 import ▼▼▼
import OrderDetailsModal from "./OrderDetailsModal.vue";
// ▲▲▲ 신규 추가 완료 ▲▲▲

export default {
  name: "OrderDeliveryManagement",
  // ▼▼▼ [신규 추가] components 등록 ▼▼▼
  components: {
    OrderDetailsModal,
  },
  // ▲▲▲ 신규 추가 완료 ▲▲▲
  data() {
    return {
      allOrders: [],
      isLoading: true,
      activeFilter: "all",
      // ▼▼▼ [신규 추가] 선택된 주문 상태 변수 ▼▼▼
      selectedOrder: null,
      // ▲▲▲ 신규 추가 완료 ▲▲▲
    };
  },
  computed: {
    filteredOrders() {
      if (this.activeFilter === "all") {
        return this.allOrders;
      }
      return this.allOrders.filter(
        (order) => order.status === this.activeFilter,
      );
    },
  },
  async created() {
    await this.fetchOrders();
  },
  methods: {
    async fetchOrders() {
      // (기존 코드와 동일)
    },
    setFilter(status) {
      // (기존 코드와 동일)
    },
    formatDate(timestamp) {
      // (기존 코드와 동일)
    },
    formatStatus(status) {
      const map = {
        pending: "결제대기",
        paid: "배송준비",
        shipped: "배송완료",
        cancelled: "주문취소",
      };
      return map[status] || status;
    },
    // ▼▼▼ [수정됨] openOrderDetails 메소드 로직 변경 ▼▼▼
    openOrderDetails(order) {
      this.selectedOrder = order;
    },
    // ▲▲▲ 수정 완료 ▲▲▲
    // ▼▼▼ [신규 추가] 주문 업데이트 처리 핸들러 ▼▼▼
    handleOrderUpdate() {
      this.selectedOrder = null;
      this.fetchOrders(); // 목록 새로고침
    },
    // ▲▲▲ 신규 추가 완료 ▲▲▲
  },
};
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
  /* 로딩 스피너 스타일 */
}
</style>
