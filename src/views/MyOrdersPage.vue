<template>
  <div class="page-container">
    <header class="page-header">
      <h1><i class="fas fa-box-open"></i> 나의 주문 내역</h1>
      <p class="description">
        솔트메이트 몰에서의 주문 및 배송 현황을 확인합니다.
      </p>
    </header>

    <nav class="sub-nav">
      <router-link to="/shop" class="sub-nav-item">상품 목록</router-link>
      <router-link to="/my-orders" class="sub-nav-item active"
        >나의 주문 내역</router-link
      >
    </nav>
    <main class="content-wrapper card">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else-if="orders.length === 0" class="empty-state">
        <p>주문 내역이 없습니다.</p>
        <router-link to="/shop" class="btn-primary">쇼핑하러 가기</router-link>
      </div>
      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>주문일시</th>
              <th>주문 상품</th>
              <th>결제 금액</th>
              <th>배송 상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td>{{ formatDate(order.createdAt) }}</td>
              <td>{{ getOrderItemsText(order.orderItems) }}</td>
              <td>{{ (order.totalPrice || 0).toLocaleString() }} P</td>
              <td>
                <span :class="['status-badge', order.status]">{{
                  formatStatus(order.status)
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script>
import { auth, db } from "@/firebaseConfig";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

export default {
  name: "MyOrdersPage",
  data() {
    return {
      orders: [],
      isLoading: true,
      error: null,
    };
  },
  async created() {
    await this.fetchMyOrders();
  },
  methods: {
    async fetchMyOrders() {
      this.isLoading = true;
      if (!auth.currentUser) {
        this.error = "로그인이 필요합니다.";
        this.isLoading = false;
        return;
      }
      try {
        const q = query(
          collection(db, "orders"),
          where("userId", "==", auth.currentUser.uid),
          orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        this.orders = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error("주문 내역 조회 오류:", error);
        this.error = "주문 내역을 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
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
    getOrderItemsText(items) {
      if (!items || items.length === 0) return "상품 정보 없음";
      const firstItem = items[0];
      let text = `${firstItem.productName} ${firstItem.quantity}개`;
      if (items.length > 1) {
        text += ` 외 ${items.length - 1}건`;
      }
      return text;
    },
  },
};
</script>

<style scoped>
.page-container {
  padding: 20px;
  max-width: 1000px;
  margin: 70px auto 20px auto;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.8em;
  color: #333;
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.content-wrapper {
  padding: 30px;
  border-radius: 15px;
}
.card {
  background: #fff;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
}
.loading-state,
.empty-state,
.error-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
.empty-state p {
  margin-bottom: 20px;
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
  font-weight: bold;
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
.btn-primary {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
}
.back-button {
  background: #007bff;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  text-decoration: none;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 40px;
  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
}
.back-button:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
}
</style>
