<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3><i class="fas fa-bell"></i> 알림 설정</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>

      <div class="modal-body">
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
        </div>
        <div v-else class="settings-list">
          <div class="setting-item">
            <label for="onProfit">수익 정산 알림</label>
            <p>주간 수익 정산이 완료되었을 때 알림을 받습니다.</p>
            <label class="switch">
              <input
                type="checkbox"
                id="onProfit"
                v-model="settings.onProfitSettlement"
              />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-item">
            <label for="onDownline">신규 하위 회원 알림</label>
            <p>나의 하위 라인에 새로운 회원이 가입했을 때 알림을 받습니다.</p>
            <label class="switch">
              <input
                type="checkbox"
                id="onDownline"
                v-model="settings.onNewDownlineMember"
              />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="setting-item">
            <label for="onNotice">공지사항 알림</label>
            <p>새로운 공지사항이 등록되었을 때 알림을 받습니다.</p>
            <label class="switch">
              <input
                type="checkbox"
                id="onNotice"
                v-model="settings.onNotice"
              />
              <span class="slider round"></span>
            </label>
          </div>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            취소
          </button>
          <button
            type="button"
            class="btn-primary"
            @click="saveSettings"
            :disabled="isSaving"
          >
            <span v-if="isSaving" class="spinner-small"></span>
            <span v-else>설정 저장</span>
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script>
import { auth, db } from "@/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default {
  name: "NotificationSettingsModal",
  emits: ["close"],
  data() {
    return {
      settings: {
        onProfitSettlement: true,
        onNewDownlineMember: true,
        onNotice: true,
      },
      isLoading: true,
      isSaving: false,
    };
  },
  async created() {
    await this.loadSettings();
  },
  methods: {
    async loadSettings() {
      this.isLoading = true;
      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().notificationSettings) {
          this.settings = {
            ...this.settings,
            ...userSnap.data().notificationSettings,
          };
        }
      } catch (error) {
        console.error("알림 설정 로딩 오류:", error);
      } finally {
        this.isLoading = false;
      }
    },
    async saveSettings() {
      this.isSaving = true;
      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, {
          notificationSettings: this.settings,
        });
        alert("알림 설정이 저장되었습니다.");
        this.$emit("close");
      } catch (error) {
        console.error("알림 설정 저장 오류:", error);
        alert("저장에 실패했습니다.");
      } finally {
        this.isSaving = false;
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
  z-index: 1001;
}
.modal-content {
  width: 90%;
  max-width: 500px;
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

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.setting-item {
  display: grid;
  grid-template-columns: 1fr 60px;
  grid-template-areas:
    "label switch"
    "desc switch";
  gap: 5px 15px;
  align-items: center;
}
.setting-item label[for] {
  /* label 태그 중 for 속성이 있는 것만 선택 */
  grid-area: label;
  font-weight: bold;
  font-size: 1.1em;
  margin: 0;
}
.setting-item p {
  grid-area: desc;
  font-size: 0.9em;
  color: #666;
  margin: 0;
}
.switch {
  grid-area: switch;
  position: relative;
  display: inline-block;
  width: 50px;
  height: 28px;
  justify-self: center;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
}
input:checked + .slider {
  background-color: #28a745;
}
input:checked + .slider:before {
  transform: translateX(22px);
}
.slider.round {
  border-radius: 34px;
}
.slider.round:before {
  border-radius: 50%;
}
</style>
