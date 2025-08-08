<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3><i class="fas fa-history"></i> 수익 사이클 누적 내역</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>
      <div class="modal-body">
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
        </div>
        <ul v-else class="transaction-list">
          <li v-for="tx in transactions" :key="tx.id" class="transaction-item">
            <div class="tx-info">
              <span class="tx-description">{{ tx.description }}</span>
              <span class="tx-date">{{ formatDate(tx.timestamp) }}</span>
            </div>
            <div class="tx-amount positive">
              + {{ tx.amount.toLocaleString() }} 원
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
// ... TransactionHistoryModal.vue 와 유사한 스크립트 로직 ...
// transaction 타입: DIRECT_BONUS, ROI_BONUS, MATCHING_BONUS 등
</script>

<style scoped>
/* TransactionHistoryModal.vue 와 유사한 스타일 */
</style>
