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
        
        <button @click="issueCode" class="btn btn-secondary" :disabled="isIssuingCode">
          {{ isIssuingCode ? '발급 중...' : '보상 코드 발급' }}
        </button>
        <button @click="saveUser" class="btn btn-primary" :disabled="isSaving">
          {{ isSaving ? '저장 중...' : '저장' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits, watch } from "vue";
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
const isIssuingCode = ref(false); // 코드 발급 로딩 상태

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

// --- [핵심 수정] '보상 코드 발급' 관련 로직 ---
const issueCode = async () => {
  // 간단한 prompt 창으로 발급할 보상 종류를 선택
  const rewardType = prompt("'헬리아의 온기' 버프 코드를 발급하려면 'HELIAS_WARMTH'를 입력하세요.", "HELIAS_WARMTH");
  if (!rewardType) {
    alert("보상 종류 입력이 취소되었습니다.");
    return;
  }

  if (!confirm(`'${localUser.value.name}'님에게 '${rewardType}' 보상 코드를 발급하시겠습니까?`)) {
    return;
  }

  isIssuingCode.value = true;
  try {
    const issueFunc = httpsCallable(functions, 'issueRewardCodeToUser');
    const result = await issueFunc({
      userId: localUser.value.uid,
      rewardType: rewardType,
    });
    alert(`성공: '${localUser.value.name}'님에게 보상 코드 [${result.data.code}]가 발급되었습니다. 이제 해당 사용자의 '내 보상 코드함'에서 확인할 수 있습니다.`);
  } catch (error) {
    alert(`코드 발급 실패: ${error.message}`);
  } finally {
    isIssuingCode.value = false;
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
  position: relative;
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
</style>