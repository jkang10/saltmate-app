<template>
  <div class="management-container">
    <h3><i class="fas fa-truck-loading"></i> 주문 배송 관리</h3>
    <p>고객 주문을 확인하고 배송 상태를 업데이트합니다.</p>

    <div class="order-list card">
      <h4>전체 주문 목록</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <table v-else-if="orders.length > 0" class="order-table">
        <thead>
          <tr>
            <th>주문일</th>
            <th>주문번호</th>
            <th>주문자</th>
            <th>주문 상품</th>
            <th>총 결제금액</th>
            <th>배송 상태</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td>{{ formatDate(order.createdAt) }}</td>
            <td>{{ order.orderId }}</td>
            <td>{{ order.userName }}</td>
            <td>{{ getOrderItemsSummary(order.items) }}</td>
            <td>{{ formatCurrency(order.totalAmount) }}</td>
            <td>
              <select
                v-model="order.status"
                @change="updateStatus(order, $event.target.value)"
                class="status-select"
              >
                <option value="paymentCompleted">결제 완료</option>
                <option value="preparing">배송 준비중</option>
                <option value="shipping">배송중</option>
                <option value="delivered">배송 완료</option>
                <option value="cancelled">주문 취소</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">주문 내역이 없습니다.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  orderBy,
  query,
} from "firebase/firestore";

const orders = ref([]);
const loading = ref(true);

// --- Helper Functions ---
const formatDate = (timestamp) => {
  if (!timestamp) return "";
  return timestamp.toDate().toLocaleString("ko-KR");
};
const formatCurrency = (value) =>
  new Intl.NumberFormat("ko-KR").format(value) + "원";

const getOrderItemsSummary = (items) => {
  if (!items || items.length === 0) return "상품 정보 없음";
  const firstItemName = items[0].productName || "상품";
  const remainingCount = items.length - 1;
  return remainingCount > 0
    ? `${firstItemName} 외 ${remainingCount}건`
    : firstItemName;
};

const getStatusText = (status) => {
  const statusMap = {
    paymentCompleted: "결제 완료",
    preparing: "배송 준비중",
    shipping: "배송중",
    delivered: "배송 완료",
    cancelled: "주문 취소",
  };
  return statusMap[status] || status;
};

// --- Firestore Functions ---
const fetchOrders = async () => {
  loading.value = true;
  try {
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    orders.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("주문 목록을 불러오는 중 오류 발생:", error);
    alert("주문 목록을 불러오는 데 실패했습니다.");
  } finally {
    loading.value = false;
  }
};

const updateStatus = async (order, newStatus) => {
  const newStatusText = getStatusText(newStatus);
  if (
    !confirm(
      `'${order.userName}'님의 주문 상태를 '${newStatusText}'(으)로 변경하시겠습니까?`
    )
  ) {
    // 사용자가 '취소'를 누르면, select의 값을 원래대로 되돌립니다.
    event.target.value = order.status;
    return;
  }

  try {
    const orderRef = doc(db, "orders", order.id);
    await updateDoc(orderRef, { status: newStatus });
    alert("주문 상태가 성공적으로 변경되었습니다.");
    // 로컬 데이터도 업데이트하여 UI에 즉시 반영
    order.status = newStatus;
  } catch (error) {
    console.error("주문 상태 변경 중 오류 발생: ", error);
    alert("주문 상태 변경에 실패했습니다.");
    event.target.value = order.status; // 오류 발생 시 원래 상태로 복구
  }
};

onMounted(fetchOrders);
</script>

<style scoped>
/* 이전 컴포넌트들과 유사한 스타일 */
.management-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.card {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3,
h4 {
  margin-top: 0;
}

.order-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.order-table th,
.order-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
  vertical-align: middle;
}
.order-table th {
  background-color: #f8f9fa;
}

/* 상태 변경 드롭다운 */
.status-select {
  padding: 6px 10px;
  border-radius: 5px;
  border: 1px solid #ccc;
  background-color: #fff;
  cursor: pointer;
}
.status-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

/* 로딩 및 데이터 없음 스타일 */
.loading-spinner,
.no-data {
  text-align: center;
  padding: 50px;
  color: #777;
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
  to {
    transform: rotate(360deg);
  }
}
</style>
