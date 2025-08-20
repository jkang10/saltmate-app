<template>
  <div class="settings-manager">
    <h2><i class="fas fa-gamepad"></i> 게임 재화 전환 설정</h2>

    <div class="card">
      <div class="form-group">
        <label for="salt-rate">
          <i class="fas fa-gem"></i> 소금 광산 (Salt ➞ SaltMate)
        </label>
        <div class="input-group">
          <input
            type="number"
            id="salt-rate"
            v-model.number="settings.saltMineRate"
            placeholder="예: 1000"
          />
          <span> Salt = 1 SaltMate</span>
        </div>
        <small>1 SaltMate를 얻기 위해 필요한 소금의 개수를 입력하세요.</small>
      </div>

      <div class="form-group">
        <label for="sea-rate">
          <i class="fas fa-water"></i> 해양심층수 탐험 (자금 ➞ SaltMate)
        </label>
        <div class="input-group">
          <input
            type="number"
            id="sea-rate"
            v-model.number="settings.deepSeaRate"
            placeholder="예: 100000"
          />
          <span> 자금 = 1 SaltMate</span>
        </div>
        <small>1 SaltMate를 얻기 위해 필요한 자금의 액수를 입력하세요.</small>
      </div>

      <div class="actions">
        <button class="btn-save" @click="saveSettings" :disabled="isLoading">
          <span v-if="isLoading" class="spinner"></span>
          <span v-else>설정 저장</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { db, functions } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { reactive, onMounted, ref } from "vue";

export default {
  name: "GameConversionSettings",
  setup() {
    const isLoading = ref(false);
    const settings = reactive({
      saltMineRate: 1000,
      deepSeaRate: 100000,
    });

    const fetchSettings = async () => {
      isLoading.value = true;
      try {
        const configRef = doc(db, "configuration", "gameSettings");
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          settings.saltMineRate = data.saltMineRate;
          settings.deepSeaRate = data.deepSeaRate;
        }
      } catch (error) {
        console.error("설정 불러오기 실패:", error);
        alert("기존 설정을 불러오는 데 실패했습니다.");
      } finally {
        isLoading.value = false;
      }
    };

    const saveSettings = async () => {
      if (
        !settings.saltMineRate ||
        !settings.deepSeaRate ||
        settings.saltMineRate < 1 ||
        settings.deepSeaRate < 1
      ) {
        alert("모든 값을 1 이상으로 올바르게 입력해주세요.");
        return;
      }
      if (!confirm("게임 전환 설정을 저장하시겠습니까?")) return;

      isLoading.value = true;
      try {
        const updateSettings = httpsCallable(
          functions,
          "updateGameConversionSettings",
        );
        await updateSettings({
          saltMineRate: settings.saltMineRate,
          deepSeaRate: settings.deepSeaRate,
        });
        alert("설정이 성공적으로 저장되었습니다.");
      } catch (error) {
        console.error("설정 저장 실패:", error);
        alert(`저장 중 오류가 발생했습니다: ${error.message}`);
      } finally {
        isLoading.value = false;
      }
    };

    onMounted(fetchSettings);

    return { settings, isLoading, saveSettings };
  },
};
</script>

<style scoped>
.settings-manager {
  padding: 20px;
}
.settings-manager h2 {
  font-size: 1.8em;
  margin-bottom: 20px;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 30px;
  max-width: 600px;
}
.form-group {
  margin-bottom: 25px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 10px;
  font-size: 1.1em;
}
.form-group label i {
  margin-right: 8px;
  color: #007bff;
}
.input-group {
  display: flex;
  align-items: center;
}
.input-group input {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1em;
  width: 200px;
}
.input-group span {
  margin-left: 10px;
  font-weight: bold;
}
.form-group small {
  display: block;
  margin-top: 8px;
  color: #6c757d;
}
.actions {
  margin-top: 30px;
  border-top: 1px solid #eee;
  padding-top: 20px;
}
.btn-save {
  padding: 12px 25px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1.1em;
  cursor: pointer;
}
.btn-save:disabled {
  background-color: #a0c9ff;
}
.spinner {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
  display: inline-block;
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
