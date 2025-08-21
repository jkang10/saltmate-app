<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content" v-if="order">
      <header class="modal-header">
        <h3><i class="fas fa-clipboard-list"></i> 주문 상세 정보</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>

      <div class="modal-body">
        <div class="info-grid">
          <div><strong>주문 ID:</strong> {{ order.id }}</div>
          <div>
            <strong>주문일시:</strong> {{ formatDate(order.createdAt) }}
          </div>
          <div><strong>주문자명:</strong> {{ order.userName }}</div>
          <div>
            <strong>상태:</strong>
            <span :class="['status-badge', order.status]">{{
              formatStatus(order.status)
            }}</span>
          </div>
        </div>

        <h4>주문 상품 목록</h4>
        <ul class="item-list">
          <li v-for="(item, index) in order.orderItems" :key="index">
            <span>{{ item.productName }}</span>
            <span>{{ item.quantity }}개</span>
            <span>{{ (item.price * item.quantity).toLocaleString() }} P</span>
          </li>
        </ul>
        <div class="total-price">
          <strong>총 주문금액:</strong>
          <strong
            >{{ (order.totalPrice || 0).toLocaleString() }} SaltMate</strong
          >
        </div>
      </div>

      <footer class="modal-footer">
        <div class="status-actions">
          <button
            @click="updateStatus('shipped')"
            class="btn-shipped"
            :disabled="order.status === 'shipped'"
          >
            <i class="fas fa-shipping-fast"></i> 배송 완료로 변경
          </button>
          <button
            @click="updateStatus('cancelled')"
            class="btn-cancelled"
            :disabled="order.status === 'cancelled'"
          >
            <i class="fas fa-times-circle"></i> 주문 취소로 변경
          </button>
        </div>
        <button type="button" class="btn-secondary" @click="$emit('close')">
          닫기
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from "vue";
import { getFunctions, httpsCallable } from "firebase/functions";

const props = defineProps({
  order: { type: Object, required: true },
});
const emit = defineEmits(["close", "order-updated"]);

const formatDate = (timestamp) =>
  timestamp?.toDate().toLocaleString("ko-KR") || "";
const formatStatus = (status) => {
  const map = { paid: "배송준비", shipped: "배송완료", cancelled: "주문취소" };
  return map[status] || status;
};

const updateStatus = async (newStatus) => {
  const statusText = newStatus === "shipped" ? "배송 완료" : "주문 취소";
  if (!confirm(`이 주문을 '${statusText}' 상태로 변경하시겠습니까?`)) return;

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const updateOrderStatus = httpsCallable(functions, "updateOrderStatus");
    await updateOrderStatus({ orderId: props.order.id, newStatus: newStatus });

    alert(`주문 상태가 '${statusText}'(으)로 성공적으로 변경되었습니다.`);
    emit("order-updated");
    emit("close");
  } catch (error) {
    console.error("주문 상태 변경 실패:", error);
    alert(`오류: ${error.message}`);
  }
};
</script>

<style scoped>
/* 모달 스타일 */
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
  max-width: 600px;
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
}
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}
.item-list {
  list-style: none;
  padding: 0;
  margin: 10px 0;
}
.item-list li {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  margin-bottom: 5px;
}
.total-price {
  text-align: right;
  font-size: 1.1em;
  margin-top: 15px;
}
.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-top: 1px solid #eee;
}
.status-actions {
  display: flex;
  gap: 10px;
}
.status-actions button {
  border: none;
  padding: 8px 12px;
  border-radius: 5px;
  cursor: pointer;
  color: white;
  font-weight: bold;
}
.btn-shipped {
  background-color: #28a745;
}
.btn-cancelled {
  background-color: #dc3545;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 5px;
  cursor: pointer;
}
.status-badge {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.85em;
  font-weight: bold;
  color: #fff;
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
</style>
