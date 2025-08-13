<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card" v-if="user">
      <header class="modal-header">
        <h3><i class="fas fa-wallet"></i> {{ user.name }}님 잔액 조정</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>
      <form class="modal-body" @submit.prevent="handleAdjustment">
        <div class="current-balances">
          <p>
            현금성 수익:
            <strong>{{ (user.cashBalance || 0).toLocaleString() }} 원</strong>
          </p>
          <p>
            솔트메이트:
            <strong>{{ (user.saltmatePoints || 0).toLocaleString() }} P</strong>
          </p>
        </div>
        <div class="form-group">
          <label>조정 대상</label>
          <select v-model="form.balanceType">
            <option value="cashBalance">현금성 수익</option>
            <option value="saltmatePoints">솔트메이트</option>
          </select>
        </div>
        <div class="form-group">
          <label>조정 금액 (차감 시 음수 입력)</label>
          <input
            type="number"
            v-model.number="form.amount"
            placeholder="예: 10000 (증가), -5000 (차감)"
            required
          />
        </div>
        <div class="form-group">
          <label>사유</label>
          <input
            type="text"
            v-model="form.reason"
            placeholder="예: 이벤트 보상 지급"
            required
          />
        </div>
        <p v-if="error" class="error-message">{{ error }}</p>
        <footer class="modal-footer">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            취소
          </button>
          <button type="submit" class="btn-primary" :disabled="isProcessing">
            <span v-if="isProcessing">처리 중...</span>
            <span v-else>적용하기</span>
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, defineProps, defineEmits } from "vue";
import { getFunctions, httpsCallable } from "firebase/functions";

const props = defineProps({ user: { type: Object, required: true } });
const emit = defineEmits(["close", "balance-updated"]);

const form = reactive({ balanceType: "cashBalance", amount: null, reason: "" });
const isProcessing = ref(false);
const error = ref(null);

const handleAdjustment = async () => {
  isProcessing.value = true;
  error.value = null;
  try {
    const functions = getFunctions();
    const adjustUserBalance = httpsCallable(functions, "adjustUserBalance");
    const result = await adjustUserBalance({
      targetUserId: props.user.id,
      balanceType: form.balanceType,
      amount: form.amount,
      reason: form.reason,
    });
    alert(result.data.message);
    emit("balance-updated");
    emit("close");
  } catch (err) {
    error.value = `작업 실패: ${err.message}`;
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  width: 90%;
  max-width: 450px;
}
.current-balances {
  display: flex;
  gap: 20px;
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 20px;
}
</style>
