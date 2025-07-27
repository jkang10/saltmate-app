<template>
  <div class="admin-section">
    <h3><i class="fas fa-chart-pie"></i> 지분 관리</h3>
    <p>
      여기에 전체 공장 지분 현황, 사용자별 지분 할당 및 변경, 지분 리포트 관리
      기능을 구현합니다.
    </p>
  </div>
</template>

<script>
export default {
  name: "EquityManagement",
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
