<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3><i class="fas fa-key"></i> 비밀번호 변경</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>

      <form class="modal-body" @submit.prevent="handleChangePassword">
        <div v-if="successMessage" class="success-message">
          {{ successMessage }}
        </div>

        <div class="form-group">
          <label for="current-password">현재 비밀번호</label>
          <input
            type="password"
            id="current-password"
            v-model="currentPassword"
            required
          />
        </div>
        <div class="form-group">
          <label for="new-password">새 비밀번호 (6자 이상)</label>
          <input
            type="password"
            id="new-password"
            v-model="newPassword"
            required
          />
        </div>
        <div class="form-group">
          <label for="confirm-password">새 비밀번호 확인</label>
          <input
            type="password"
            id="confirm-password"
            v-model="confirmNewPassword"
            required
          />
        </div>

        <p v-if="error" class="error-message">{{ error }}</p>

        <footer class="modal-footer">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            취소
          </button>
          <button type="submit" class="btn-primary" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-small"></span>
            <span v-else>변경하기</span>
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script>
import { auth } from "@/firebaseConfig";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

export default {
  name: "ChangePasswordModal",
  emits: ["close"],
  data() {
    return {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
      isLoading: false,
      error: null,
      successMessage: null,
    };
  },
  methods: {
    async handleChangePassword() {
      this.isLoading = true;
      this.error = null;
      this.successMessage = null;

      if (this.newPassword !== this.confirmNewPassword) {
        this.error = "새 비밀번호가 일치하지 않습니다.";
        this.isLoading = false;
        return;
      }
      if (this.newPassword.length < 6) {
        this.error = "새 비밀번호는 6자 이상이어야 합니다.";
        this.isLoading = false;
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        this.error = "로그인 정보가 유효하지 않습니다.";
        this.isLoading = false;
        return;
      }

      try {
        const credential = EmailAuthProvider.credential(
          user.email,
          this.currentPassword,
        );
        await reauthenticateWithCredential(user, credential);

        await updatePassword(user, this.newPassword);

        this.successMessage = "비밀번호가 성공적으로 변경되었습니다.";
        setTimeout(() => this.$emit("close"), 2000);
      } catch (err) {
        console.error("비밀번호 변경 오류:", err.code);
        if (err.code === "auth/wrong-password") {
          this.error = "현재 비밀번호가 올바르지 않습니다.";
        } else {
          this.error = "오류가 발생했습니다. 다시 시도해주세요.";
        }
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<style scoped>
/* ▼▼▼ [수정됨] 완전한 모달 스타일 추가 ▼▼▼ */
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
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
}
.form-group input {
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
.success-message {
  color: #155724;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  padding: 10px;
  border-radius: 5px;
  text-align: center;
  margin-bottom: 15px;
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
