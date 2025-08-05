<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card" v-if="userProfile">
      <header class="modal-header">
        <h3><i class="fas fa-money-bill-wave"></i> 출금 신청하기</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>

      <form class="modal-body" @submit.prevent="handleWithdrawalRequest">
        <div class="balance-info">
          <label>출금 가능 잔액</label>
          <strong
            >{{ (userProfile.cashBalance || 0).toLocaleString() }} 원</strong
          >
        </div>

        <div class="form-group">
          <label for="withdrawal-amount">출금 신청 금액</label>
          <input
            type="number"
            id="withdrawal-amount"
            v-model.number="amount"
            placeholder="50,000원 단위로 입력"
            step="50000"
            min="50000"
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
            <span v-else>신청하기</span>
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script>
// TODO: 백엔드에 실제 출금 요청을 보내는 Cloud Function 연동이 필요합니다.
// import { getFunctions, httpsCallable } from "firebase/functions";

export default {
  name: "WithdrawalRequestModal",
  props: {
    userProfile: {
      type: Object,
      required: true,
    },
  },
  emits: ["close"],
  data() {
    return {
      amount: null,
      isProcessing: false,
      error: null,
    };
  },
  methods: {
    async handleWithdrawalRequest() {
      this.error = null;
      if (!this.amount || this.amount <= 0) {
        this.error = "출금할 금액을 입력해주세요.";
        return;
      }
      if (this.amount > this.userProfile.cashBalance) {
        this.error = "출금 가능 잔액을 초과할 수 없습니다.";
        return;
      }
      if (this.amount % 50000 !== 0) {
        this.error = "출금은 50,000원 단위로만 가능합니다.";
        return;
      }

      this.isProcessing = true;
      try {
        // const functions = getFunctions();
        // const requestWithdrawal = httpsCallable(functions, 'requestWithdrawal');
        // await requestWithdrawal({ amount: this.amount });

        console.log(`출금 요청 금액: ${this.amount}`);
        alert(
          `${this.amount.toLocaleString()}원 출금 신청이 완료되었습니다. (백엔드 연동 필요)`,
        );
        this.$emit("close");
      } catch (err) {
        this.error = `신청 실패: ${err.message}`;
      } finally {
        this.isProcessing = false;
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
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
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
  display: flex;
  align-items: center;
  gap: 10px;
}
.close-button {
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
}
.modal-body {
  padding: 25px;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 15px 20px;
  border-top: 1px solid #eee;
}
.balance-info {
  text-align: center;
  margin-bottom: 25px;
}
.balance-info label {
  display: block;
  color: #666;
  font-size: 1em;
}
.balance-info strong {
  font-size: 2em;
  color: #007bff;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 8px;
}
.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-sizing: border-box;
  font-size: 1em;
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
  padding: 10px 18px;
  cursor: pointer;
  font-weight: bold;
}
.btn-primary {
  background-color: #28a745;
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
