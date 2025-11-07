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

  // ▼▼▼ [★핵심 수정★] 유효성 검사를 추가합니다. ▼▼▼
  if (form.amount === null || form.amount === 0) {
    error.value = "작업 실패: 조정 금액은 0이 될 수 없습니다.";
    isProcessing.value = false;
    return;
  }
  if (!form.reason || form.reason.trim() === "") {
    error.value = "작업 실패: 사유를 반드시 입력해야 합니다.";
    isProcessing.value = false;
    return;
  }
  // ▲▲▲ (수정 완료) ▲▲▲

  try {
    // [★수정★] functions 인스턴스를 'asia-northeast3' 리전으로 초기화합니다.
    const functionsInstance = getFunctions(undefined, "asia-northeast3");
    const adjustUserBalance = httpsCallable(functionsInstance, "adjustUserBalance");
    
   // ▼▼▼ [핵심 수정] 'props.user.id' -> 'props.user.uid' ▼▼▼
    const result = await adjustUserBalance({
      targetUserId: props.user.uid, //
      balanceType: form.balanceType,
      amount: form.amount,
      reason: form.reason,
    });
    // ▲▲▲ (수정 완료) ▲▲▲
    
    alert(result.data.message);
    emit("balance-updated");
    emit("close");
  } catch (err) {
    // [★수정★] err.message에 이미 "작업 실패:"가 포함될 수 있으므로 정리
    if (err.message.includes("permission-denied")) {
      error.value = "작업 실패: 권한이 없습니다.";
    } else if (err.message.includes("invalid-argument")) {
      error.value = "작업 실패: 입력값이 잘못되었습니다.";
    } else {
      error.value = `작업 실패: ${err.message}`;
    }
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
  z-index: 1001;
}
.modal-content {
  width: 90%;
  max-width: 450px;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3); /* [★추가★] 그림자 스타일 */
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}
/* [★추가★] 헤더 아이콘 스타일 */
.modal-header h3 {
  margin: 0;
  font-size: 1.4em;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #333;
}
/* [★추가★] 닫기 버튼 스타일 */
.close-button {
  background: none;
  border: none;
  font-size: 2em;
  line-height: 1;
  cursor: pointer;
  color: #888;
  padding: 0 5px;
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
  background-color: #f8f9fa; /* [★추가★] 푸터 배경색 */
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}
.current-balances {
  display: flex;
  flex-direction: column; /* [★수정★] 세로 정렬 */
  gap: 5px; /* [★수정★] 간격 축소 */
  background-color: #f8f9fa;
  padding: 15px; /* [★수정★] 패딩 조정 */
  border-radius: 8px;
  margin-bottom: 20px;
  border: 1px solid #eee; /* [★추가★] 테두리 */
}
/* [★추가★] p 태그 마진 제거 */
.current-balances p {
  margin: 0;
  font-size: 1em;
  color: #555;
}
.current-balances p strong {
  font-size: 1.1em;
  color: #000;
  margin-left: 5px;
}

/* [★추가★] 폼 그룹 스타일 */
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 0.95em;
}
.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1em;
  box-sizing: border-box; /* [★추가★] */
}
.form-group input:focus,
.form-group select:focus {
  border-color: #007bff;
  outline: none;
}

/* [★추가★] 버튼 공통 스타일 */
.btn-primary,
.btn-secondary {
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.95em;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}
.btn-primary:disabled {
  background-color: #a0c9ff;
  cursor: not-allowed;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
.btn-secondary:hover {
  background-color: #5a6268;
}

/* [★추가★] 오류 메시지 */
.error-message {
  color: #e74c3c;
  font-size: 0.9em;
  margin-top: 15px;
  text-align: center;
  font-weight: 600;
}
</style>