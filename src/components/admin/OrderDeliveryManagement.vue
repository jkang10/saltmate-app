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
        @click="setFilter('pending')"
        :class="{ active: activeFilter === 'pending' }"
      >
        결제대기
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
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export default {
  name: "OrderDeliveryManagement",
  data() {
    return {
      allOrders: [],
      isLoading: true,
      activeFilter: "all",
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
      this.isLoading = true;
      try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        this.allOrders = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error("주문 목록 조회 오류:", error);
      } finally {
        this.isLoading = false;
      }
    },
    setFilter(status) {
      this.activeFilter = status;
    },
    formatDate(timestamp) {
      return timestamp?.toDate().toLocaleString("ko-KR") || "";
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
    openOrderDetails(order) {
      alert(
        `주문 상세 보기 기능 구현 필요:\n주문자: ${order.userName}\n금액: ${order.totalPrice}`,
      );
    },
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
