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
        // 1. 현재 비밀번호로 재인증
        const credential = EmailAuthProvider.credential(
          user.email,
          this.currentPassword,
        );
        await reauthenticateWithCredential(user, credential);

        // 2. 새 비밀번호로 업데이트
        await updatePassword(user, this.newPassword);

        this.successMessage = "비밀번호가 성공적으로 변경되었습니다.";
        setTimeout(() => this.$emit("close"), 2000); // 2초 후 모달 닫기
      } catch (err) {
        console.error("비밀번호 변경 오류:", err.code);
        if (err.code === "auth/wrong-password") {
          this.error = "현재 비밀번호가 올바르지 않습니다.";
        } else if (err.code === "auth/requires-recent-login") {
          this.error = "보안을 위해 최근에 다시 로그인한 후 시도해주세요.";
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
/* 이전 모달들과 유사한 스타일 */
.modal-overlay {
  z-index: 1001; /* 다른 모달 위에 표시될 수 있도록 */
}
.modal-content {
  max-width: 450px;
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
.success-message {
  color: #155724;
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  padding: 10px;
  border-radius: 5px;
  text-align: center;
  margin-bottom: 15px;
}
</style>
