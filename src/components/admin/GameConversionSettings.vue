<template>
  <div class="settings-manager">
    <h2><i class="fas fa-gamepad"></i> 게임 설정</h2>

    <div class="card">
      <h3>재화 전환 비율 설정</h3>
      <div class="form-group">
        <label for="salt-rate"
          ><i class="fas fa-gem"></i> 소금 광산 (Salt ➞ SaltMate)</label
        >
        <div class="input-group">
          <input
            type="number"
            step="100"
            v-model.number="settings.saltMineRate"
          />
          <span> Salt = 1 SaltMate</span>
        </div>
        <small>1 SaltMate를 얻기 위해 필요한 소금의 개수를 입력하세요.</small>
      </div>
      <div class="form-group">
        <label for="sea-rate"
          ><i class="fas fa-water"></i> 해양심층수 탐험 (자금 ➞ SaltMate)</label
        >
        <div class="input-group">
          <input
            type="number"
            step="1000"
            v-model.number="settings.deepSeaRate"
          />
          <span> 자금 = 1 SaltMate</span>
        </div>
        <small>1 SaltMate를 얻기 위해 필요한 자금의 액수를 입력하세요.</small>
      </div>

      <h3 class="section-title">일일 이용 횟수 설정</h3>
      <div class="form-group">
        <label for="rps-limit"
          ><i class="fas fa-hand-scissors"></i> 가위바위보</label
        >
        <div class="input-group">
          <input type="number" step="1" v-model.number="settings.rpsLimit" />
          <span> 회 / 일</span>
        </div>
        <small>하루에 참여할 수 있는 최대 횟수를 입력하세요.</small>
      </div>
      <div class="form-group">
        <label for="high-low-limit"
          ><i class="fas fa-arrows-alt-v"></i> 하이로우</label
        >
        <div class="input-group">
          <input
            type="number"
            step="1"
            v-model.number="settings.highLowLimit"
          />
          <span> 회 / 일</span>
        </div>
        <small>하루에 참여할 수 있는 최대 횟수를 입력하세요.</small>
      </div>

      <h3 class="section-title">게임 승리 배수 설정</h3>
      <div class="form-group">
        <label for="rps-multiplier"
          ><i class="fas fa-hand-scissors"></i> 가위바위보 (승리 시)</label
        >
        <div class="input-group">
          <span>베팅금액의 </span>
          <input
            type="number"
            step="0.1"
            v-model.number="settings.rpsMultiplier"
          />
          <span> 배</span>
        </div>
      </div>
      <div class="form-group">
        <label for="high-low-multiplier"
          ><i class="fas fa-arrows-alt-v"></i> 하이로우 (성공 시)</label
        >
        <div class="input-group">
          <span>베팅금액의 </span>
          <input
            type="number"
            step="0.1"
            v-model.number="settings.highLowMultiplier"
          />
          <span> 배</span>
        </div>
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
      rpsLimit: 10,
      highLowLimit: 10,
      rpsMultiplier: 1.2,
      highLowMultiplier: 1.2,
    });

    const fetchSettings = async () => {
      isLoading.value = true;
      try {
        const configRef = doc(db, "configuration", "gameSettings");
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
          // ▼▼▼ [수정] Object.assign을 사용하여 DB에 있는 모든 설정값을 한 번에 반영합니다. ▼▼▼
          Object.assign(settings, docSnap.data());
          // ▲▲▲ 수정 완료 ▲▲▲
        }
      } catch (error) {
        console.error("설정 불러오기 실패:", error);
        alert("기존 설정을 불러오는 데 실패했습니다.");
      } finally {
        isLoading.value = false;
      }
    };

    const saveSettings = async () => {
      if (!confirm("게임 설정을 저장하시겠습니까?")) return;
      isLoading.value = true;
      try {
        const updateSettings = httpsCallable(
          functions,
          "updateGameConversionSettings",
        );
        // settings 객체 전체를 서버로 보냅니다.
        await updateSettings(settings);
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
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
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
  width: 20px;
  text-align: center;
}
.input-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.input-group input {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1em;
  width: 180px;
}
.input-group span {
  font-weight: 500;
  color: #555;
}
.form-group small {
  display: block;
  margin-top: 8px;
  color: #6c757d;
  font-size: 0.9em;
}
.section-title {
  margin-top: 40px;
  border-top: 1px solid #eee;
  padding-top: 20px;
  font-size: 1.4em;
  margin-bottom: 20px;
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
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-save:disabled {
  background-color: #a0c9ff;
}
.spinner {
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
