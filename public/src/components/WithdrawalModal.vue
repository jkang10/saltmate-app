<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>수익금 출금 신청</h2>
        <button class="close-button" @click="closeModal">&times;</button>
      </div>
      <div class="modal-body">
        <p>출금 가능한 잔액: <strong>0원</strong></p>
        <div class="form-group">
          <label for="withdrawal-amount">출금 희망 금액 (원):</label>
          <input
            type="number"
            id="withdrawal-amount"
            v-model.number="amount"
            min="1000"
            step="1000"
            placeholder="최소 1,000원 이상 입력"
          />
        </div>
        <div class="form-group">
          <label for="bank-name">은행명:</label>
          <input
            type="text"
            id="bank-name"
            v-model="bankName"
            placeholder="예: 카카오뱅크"
          />
        </div>
        <div class="form-group">
          <label for="account-number">계좌번호:</label>
          <input
            type="text"
            id="account-number"
            v-model="accountNumber"
            placeholder="계좌번호 입력"
          />
        </div>
        <div class="form-group">
          <label for="account-holder">예금주명:</label>
          <input
            type="text"
            id="account-holder"
            v-model="accountHolder"
            placeholder="예금주명 입력"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="cancel-button" @click="closeModal">취소</button>
        <button class="submit-button" @click="submitWithdrawal">
          신청하기
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  name: "WithdrawalModal",
  props: {
    isVisible: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { emit }) {
    const amount = ref(0);
    const bankName = ref("");
    const accountNumber = ref("");
    const accountHolder = ref("");

    const closeModal = () => {
      emit("close");
      resetForm();
    };

    const submitWithdrawal = () => {
      if (
        amount.value <= 0 ||
        !bankName.value ||
        !accountNumber.value ||
        !accountHolder.value
      ) {
        alert("모든 필드를 올바르게 입력해주세요.");
        return;
      }
      emit("submit", {
        amount: amount.value,
        bankName: bankName.value,
        accountNumber: accountNumber.value,
        accountHolder: accountHolder.value,
      });
      resetForm();
    };

    const resetForm = () => {
      amount.value = 0;
      bankName.value = "";
      accountNumber.value = "";
      accountHolder.value = "";
    };

    return {
      amount,
      bankName,
      accountNumber,
      accountHolder,
      closeModal,
      submitWithdrawal,
    };
  },
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.modal-content {
  background: rgba(255, 255, 255, 0.85); /* Glassmorphism light background */
  border-radius: 16px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  width: 90%;
  max-width: 500px;
  padding: 30px;
  position: relative;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 15px;
}

.modal-header h2 {
  font-size: 1.8em;
  color: #333;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 2em;
  cursor: pointer;
  color: #666;
  transition: color 0.3s ease;
}

.close-button:hover {
  color: #333;
}

.modal-body {
  margin-bottom: 30px;
}

.modal-body p {
  font-size: 1.1em;
  color: #555;
  margin-bottom: 20px;
  text-align: center;
}

.modal-body strong {
  color: #28a745;
  font-size: 1.2em;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
  color: #444;
  font-size: 0.95em;
}

.form-group input[type="number"],
.form-group input[type="text"] {
  width: calc(100% - 20px);
  padding: 12px 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  outline: none;
  transition: border-color 0.3s ease;
  background-color: rgba(255, 255, 255, 0.7); /* Slightly transparent input */
}

.form-group input[type="number"]:focus,
.form-group input[type="text"]:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.submit-button,
.cancel-button {
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  transition: background-color 0.3s ease, transform 0.2s ease;
}

.submit-button {
  background-color: #28a745;
  color: white;
}

.submit-button:hover {
  background-color: #218838;
  transform: translateY(-2px);
}

.cancel-button {
  background-color: #6c757d;
  color: white;
}

.cancel-button:hover {
  background-color: #5a6268;
  transform: translateY(-2px);
}
</style>
