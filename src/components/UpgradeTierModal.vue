<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3><i class="fas fa-arrow-up"></i> 등급 추가 구매</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>

      <form class="modal-body" @submit.prevent="handleUpgradeRequest">
        <p class="description">
          추가로 구매할 구독 등급을 선택해주세요. 신청 후 관리자의 입금 확인이
          이루어지면 기존 등급에 합산 적용됩니다.
        </p>

        <div class="form-group">
          <label for="upgrade-amount">추가 구독 금액:</label>
          <select id="upgrade-amount" v-model="selectedAmount" required>
            <option value="" disabled>금액을 선택하세요</option>
            <option value="100000">10만원</option>
            <option value="300000">30만원</option>
            <option value="500000">50만원</option>
            <option value="1000000">100만원</option>
          </select>
        </div>

        <p v-if="error" class="error-message">{{ error }}</p>

        <footer class="modal-footer">
          <button
            type="button"
            class="btn-secondary"
            @click="$emit('close')"
            :disabled="isLoading"
          >
            취소
          </button>
          <button type="submit" class="btn-primary" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-small"></span>
            <span v-else>구매 신청하기</span>
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script>
import { getFunctions, httpsCallable } from "firebase/functions";

export default {
  name: "UpgradeTierModal",
  emits: ["close"], // 부모 컴포넌트에 close 이벤트를 보냄
  data() {
    return {
      selectedAmount: "",
      isLoading: false,
      error: null,
    };
  },
  methods: {
    async handleUpgradeRequest() {
      if (!this.selectedAmount) {
        this.error = "구매할 금액을 선택해주세요.";
        return;
      }
      this.isLoading = true;
      this.error = null;

      try {
        // 백엔드의 requestSubscriptionUpgrade 함수를 호출
        const functions = getFunctions();
        const requestSubscriptionUpgrade = httpsCallable(
          functions,
          "requestSubscriptionUpgrade",
        );

        await requestSubscriptionUpgrade({
          investmentAmount: Number(this.selectedAmount),
        });

        alert(
          "등급 추가 구매 요청이 성공적으로 접수되었습니다. 관리자 승인을 기다려주세요.",
        );
        this.$emit("close"); // 성공 시 모달 닫기
      } catch (e) {
        console.error("등급 추가 구매 요청 오류:", e);
        this.error = `요청 중 오류가 발생했습니다: ${e.message}`;
      } finally {
        this.isLoading = false;
      }
    },
  },
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
  background: white;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
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
  font-size: 1.4em;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #333;
}
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
  padding: 20px 25px;
}
.description {
  font-size: 0.95em;
  color: #555;
  line-height: 1.6;
  margin-bottom: 25px;
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
  color: #333;
}
.form-group select {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  background-color: #fff;
}
.error-message {
  color: #e74c3c;
  font-size: 0.9em;
  margin-top: 15px;
  text-align: center;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px 25px;
  border-top: 1px solid #eee;
  margin-top: 20px;
}
.btn-primary,
.btn-secondary {
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1em;
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
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
