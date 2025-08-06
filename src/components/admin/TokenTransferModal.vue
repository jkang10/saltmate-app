<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card" v-if="user">
      <header class="modal-header">
        <h3><i class="fas fa-exchange-alt"></i> {{ user.name }}님 토큰 관리</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>

      <form class="modal-body" @submit.prevent="handleTransfer">
        <div class="current-balances">
          <p>
            COBS:
            <strong>{{ (user.tokens?.cobs || 0).toLocaleString() }}</strong>
          </p>
          <p>
            BND: <strong>{{ (user.tokens?.bnd || 0).toLocaleString() }}</strong>
          </p>
        </div>

        <div class="form-group">
          <label>토큰 선택</label>
          <select v-model="form.tokenType">
            <option value="COBS">COBS</option>
            <option value="BND">BND</option>
            <option value="SSC">SSC(스테이블 코인)</option>
          </select>
        </div>
        <div class="form-group">
          <label>수량 (회수 시 -50 처럼 음수로 입력)</label>
          <input
            type="number"
            v-model.number="form.quantity"
            placeholder="예: 100 (전송), -50 (회수)"
            required
          />
        </div>
        <div class="form-group">
          <label>사유</label>
          <input
            type="text"
            v-model="form.reason"
            placeholder="예: 이벤트 보상 지급, 지급 오류 회수"
            required
          />
        </div>

        <p v-if="error" class="error-message">{{ error }}</p>

        <footer class="modal-footer">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            취소
          </button>
          <button type="submit" class="btn-primary" :disabled="isProcessing">
            <span v-if="isProcessing" class="spinner-small"></span>
            <span v-else>작업 실행</span>
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, defineProps, defineEmits } from "vue";
import { getFunctions, httpsCallable } from "firebase/functions";

// 부모 컴포넌트로부터 user 객체를 받습니다.
const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
});

// 부모 컴포넌트로 이벤트를 보냅니다.
const emit = defineEmits(["close", "token-updated"]);

const form = reactive({
  tokenType: "COBS",
  quantity: null,
  reason: "",
});
const isProcessing = ref(false);
const error = ref(null);

const handleTransfer = async () => {
  if (!form.quantity || !form.reason) {
    error.value = "모든 항목을 입력해주세요.";
    return;
  }
  if (
    !confirm(
      `[${props.user.name}]님에게 ${form.tokenType} ${form.quantity.toLocaleString()}개를 ${form.quantity > 0 ? "전송" : "회수"}하시겠습니까?`,
    )
  )
    return;

  isProcessing.value = true;
  error.value = null;

  try {
    const functions = getFunctions();
    const transferTokensToUser = httpsCallable(
      functions,
      "transferTokensToUser",
    );
    const result = await transferTokensToUser({
      targetUserId: props.user.id,
      tokenType: form.tokenType,
      quantity: form.quantity,
      reason: form.reason,
    });
    alert(result.data.message);
    emit("token-updated"); // 부모 컴포넌트에 토큰 변경 사실 알림
    emit("close");
  } catch (err) {
    console.error("토큰 전송/회수 오류:", err);
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
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
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
  font-size: 1.5em;
  cursor: pointer;
}
.modal-body {
  padding: 20px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #eee;
}
.current-balances {
  display: flex;
  gap: 20px;
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
}
.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-sizing: border-box;
}
.error-message {
  color: #dc3545;
  text-align: center;
  margin-top: 15px;
}
.btn-primary,
.btn-secondary {
  border: none;
  border-radius: 5px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: bold;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-primary:disabled {
  background-color: #a0c9ff;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
.spinner-small {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
