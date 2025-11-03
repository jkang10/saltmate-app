<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3><i class="fas fa-arrow-up"></i> 등급 추가 구매</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>

      <form class="modal-body" @submit.prevent="handleUpgradeRequest">
        <p class="description">
          추가로 구매할 항목을 선택해주세요. 신청 후 관리자의 입금 확인이
          이루어지면 적용됩니다.
        </p>

        <!-- [★수정★] '추가 구독 금액'을 '10만원'으로 고정 -->
        <div class="form-group">
          <label for="upgrade-amount">추가 구독 금액:</label>
          <select id="upgrade-amount" v-model="selectedTier" required>
            <option :value="tiers[0]">
              {{ tiers[0].name }}
            </option>
          </select>
        </div>

        <!-- [★신규★] '글로벌 메리디안 매출 금액' 선택 항목 추가 -->
        <div class="form-group">
          <label for="meridian-tier">글로벌 메리디안 매출 금액 (선택):</label>
          <select id="meridian-tier" v-model="selectedMeridianTier">
            <option :value="null">선택 안함</option>
            <option v-for="tier in meridianTiers" :key="tier.id" :value="tier">
              {{ tier.name }}
            </option>
          </select>
          <small>채굴기(M2~VIP) 지급을 위한 매출 금액입니다.</small>
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
  emits: ["close"],
  data() {
    return {
      // [★수정★] '10만원'만 남기고 기본 선택
      selectedTier: { name: "10만원", amount: 100000 },
      tiers: [
        { name: "10만원", amount: 100000 },
      ],
      
      // [★신규★] 글로벌 메리디안 등급
      selectedMeridianTier: null,
      meridianTiers: [
        { id: "M1", name: "M1 (채굴기 없음)" }, // M1은 코드를 발행하지 않습니다.
        { id: "M2", name: "M2 (M2 채굴기)" },
        { id: "M3", name: "M3 (M3 채굴기)" },
        { id: "M4", name: "M4 (M4 채굴기)" },
        { id: "M5", name: "M5 (M5 채굴기)" },
        { id: "VIP", name: "VIP (VIP 채굴기)" },
      ],

      isLoading: false,
      error: null,
    };
  },
  methods: {
    async handleUpgradeRequest() {
      if (!this.selectedTier) {
        this.error = "구매할 등급을 선택해주세요.";
        return;
      }

      // [★신규★] 신청 내용 확인
      let confirmationMessage = `[기본 구독] ${this.selectedTier.name}을(를) 신청합니다.`;
      if (this.selectedMeridianTier) {
        confirmationMessage += `\n[메리디안] ${this.selectedMeridianTier.name}을(를) 함께 신청합니다.`;
      }
      confirmationMessage += "\n\n관리자 승인 후 적용됩니다. 계속하시겠습니까?";

      if (!confirm(confirmationMessage)) return;

      this.isLoading = true;
      this.error = null;

      try {
        const functions = getFunctions(undefined, "asia-northeast3");
        const requestSubscriptionUpgrade = httpsCallable(
          functions,
          "requestSubscriptionUpgrade",
        );

        // [★수정★] 서버에 'meridianTier' 정보도 함께 전달
        await requestSubscriptionUpgrade({
          investmentAmount: Number(this.selectedTier.amount),
          tierName: this.selectedTier.name,
          meridianTier: this.selectedMeridianTier ? this.selectedMeridianTier.id : null,
          meridianTierName: this.selectedMeridianTier ? this.selectedMeridianTier.name : null,
        });

        alert(
          "등급 추가 구매 요청이 성공적으로 접수되었습니다. 관리자 승인을 기다려주세요.",
        );
        this.$emit("close");
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
/* (기존 스타일 ... ) */
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
.form-group {
  margin-bottom: 20px; /* [★수정★] 간격 증가 */
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
/* [★신규★] 메리디안 선택란 하단 설명 */
.form-group small {
  display: block;
  margin-top: 8px;
  font-size: 0.85em;
  color: #6c757d;
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