<template>
  <div class="modal-overlay" @click.self="emits('close')">
    <div class="modal-content user-edit-modal">
      <header class="modal-header">
        <h3><i class="fas fa-user-edit"></i> 회원 정보 수정</h3>
        <button @click="emits('close')" class="close-button">&times;</button>
      </header>
      <div class="modal-body">
        <div class="form-group">
          <label for="name">이름</label>
          <input type="text" id="name" v-model="localUser.name" class="form-control" />
        </div>
        <div class="form-group">
          <label for="email">이메일 (수정 불가)</label>
          <input type="email" id="email" :value="localUser.email" class="form-control" disabled />
        </div>
        <div class="form-group">
          <label for="role">역할</label>
          <select id="role" v-model="localUser.role" class="form-control">
            <option value="user">일반 사용자</option>
            <option value="centerManager">센터 관리자</option>
            <option value="superAdmin">최고 관리자</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="center">소속 센터</label>
          <select id="center" v-model="localUser.centerId" class="form-control">
            <option :value="null">소속 없음</option>
            <option v-for="center in centers" :key="center.id" :value="center.id">
              {{ center.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="referrer">추천인</label>
          <select id="referrer" v-model="localUser.uplineReferrer" class="form-control">
            <option :value="null">추천인 없음</option>
            <option v-for="refUser in allUsers" :key="refUser.id" :value="refUser.id">
              {{ refUser.name }} ({{ refUser.email }})
            </option>
          </select>
        </div>
      </div>
      <footer class="modal-footer">
        <button @click="emits('close')" class="btn btn-tertiary">취소</button>
        
        <button @click="openGrantRewardModal" class="btn btn-secondary">보상 지급</button>
        <button @click="saveUser" class="btn btn-primary" :disabled="isSaving">
          {{ isSaving ? '저장 중...' : '저장' }}
        </button>
      </footer>

      <div v-if="rewardModal.visible" class="nested-modal-overlay" @click.self="rewardModal.visible = false">
        <div class="nested-modal-content">
          <h4>'{{ localUser.name }}'님에게 보상 지급</h4>
          <p>지급할 보상을 선택해주세요.</p>
          <select v-model="rewardModal.selectedReward" class="form-control">
            <option value="HELIAS_WARMTH">'헬리아의 온기' 버프 (1시간)</option>
            </select>
          <div class="modal-actions">
            <button @click="rewardModal.visible = false" class="btn btn-tertiary">취소</button>
            <button @click="confirmGrantReward" class="btn btn-primary" :disabled="rewardModal.isLoading">
              {{ rewardModal.isLoading ? '지급 중...' : '확인' }}
            </button>
          </div>
        </div>
      </div>
      </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits, reactive, watch } from "vue";
import { db, functions } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const props = defineProps({
  user: { type: Object, required: true },
  allUsers: { type: Array, default: () => [] },
});
const emits = defineEmits(['close', 'user-updated']);

const localUser = ref({});
const centers = ref([]);
const isSaving = ref(false);

watch(() => props.user, (newUser) => {
  localUser.value = { ...newUser };
}, { immediate: true });

const saveUser = async () => {
  isSaving.value = true;
  try {
    const updateUserProfileFunc = httpsCallable(functions, "updateUserProfile");
    await updateUserProfileFunc({
      uid: localUser.value.uid,
      name: localUser.value.name,
      role: localUser.value.role,
      uplineReferrer: localUser.value.uplineReferrer || null,
      centerId: localUser.value.centerId || null,
    });
    alert("사용자 정보가 성공적으로 업데이트되었습니다.");
    emits('user-updated');
    emits('close');
  } catch (error) {
    console.error("회원 정보 수정 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
};

const fetchCenters = async () => {
  try {
    const centersSnapshot = await getDocs(collection(db, "centers"));
    centers.value = centersSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));
  } catch (error) {
    console.error("센터 목록 로딩 실패:", error);
  }
};

onMounted(() => {
  fetchCenters();
});

// --- [신규] 보상 지급 관련 로직 ---
const rewardModal = reactive({
  visible: false,
  isLoading: false,
  selectedReward: 'HELIAS_WARMTH',
});

const openGrantRewardModal = () => {
  rewardModal.visible = true;
};

const confirmGrantReward = async () => {
  if (!confirm(`'${localUser.value.name}'님에게 '${rewardModal.selectedReward}' 보상을 지급하시겠습니까?`)) {
    return;
  }
  rewardModal.isLoading = true;
  try {
    const grantReward = httpsCallable(functions, 'grantRewardToUser');
    const result = await grantReward({
      userId: localUser.value.uid,
      rewardType: rewardModal.selectedReward,
    });
    alert(`성공: ${result.data.message}`);
    rewardModal.visible = false;
  } catch (error) {
    alert(`보상 지급 실패: ${error.message}`);
  } finally {
    rewardModal.isLoading = false;
  }
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
  z-index: 1001;
}
.modal-content {
  background: white;
  padding: 25px;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  position: relative; /* nested-modal-overlay의 기준점 */
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
  margin-bottom: 20px;
}
.modal-header h3 {
  margin: 0;
  font-size: 1.5em;
  display: flex;
  align-items: center;
  gap: 10px;
}
.close-button {
  background: none;
  border: none;
  font-size: 2em;
  cursor: pointer;
  line-height: 1;
}
.modal-body .form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
}
.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 1em;
  box-sizing: border-box;
}
.form-control:disabled {
  background-color: #e9ecef;
  cursor: not-allowed;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 25px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}
.btn, button {
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
  font-size: 1em;
  transition: background-color 0.2s;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-primary:hover {
  background-color: #0056b3;
}
.btn-secondary {
  background-color: #17a2b8;
  color: white;
}
.btn-secondary:hover {
  background-color: #117a8b;
}
.btn-tertiary {
  background-color: #6c757d;
  color: white;
}
.btn-tertiary:hover {
    background-color: #5a6268;
}
.btn:disabled, button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
/* Nested Modal Styles */
.nested-modal-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0,0,0,0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1002;
  border-radius: 12px;
}
.nested-modal-content {
  background: white;
  color: #333;
  padding: 25px;
  border-radius: 8px;
  width: 90%;
  max-width: 350px;
  text-align: center;
}
.nested-modal-content h4 {
  font-size: 1.3em;
  margin-top: 0;
  margin-bottom: 10px;
}
.nested-modal-content p {
  margin-bottom: 20px;
}
.nested-modal-content select {
  width: 100%;
}
.modal-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}
</style>