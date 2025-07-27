<template>
  <div class="admin-section">
    <h3><i class="fas fa-truck"></i> 주문 배송 관리</h3>
    <p>
      여기에 주문 목록을 표시하고, 배송 상태 업데이트 및 주문 취소/환불 관리
      기능을 구현합니다.
    </p>
  </div>
</template>

<script>
export default {
  name: "OrderDeliveryManagement",
};
</script>

<style scoped>
.admin-section {
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  background-color: #f9f9f9;
}
.admin-section h3 {
  color: #333;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.admin-section p {
  color: #666;
}
</style>
