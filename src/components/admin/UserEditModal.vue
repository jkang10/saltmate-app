<template>
  <div class="modal-overlay" @click.self="emits('close')">
    <div class="modal-content">
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
        <button @click="emits('close')" class="btn btn-secondary">취소</button>
        <button @click="saveUser" class="btn btn-primary" :disabled="isSaving">
          {{ isSaving ? '저장 중...' : '저장' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits } from "vue";
import { db, functions } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// 부모 컴포넌트(UserManagement.vue)로부터 props와 emits를 정의합니다.
const props = defineProps({
  user: {
    type: Object,
    required: true,
  },
  allUsers: {
    type: Array,
    default: () => [],
  },
});
const emits = defineEmits(['close', 'user-updated']);

// 내부 상태 관리를 위한 변수들
const localUser = ref({ ...props.user });
const centers = ref([]);
const isSaving = ref(false);

/**
 * [핵심 수정 3] 저장(save) 함수 구현
 * - 백엔드에 새로 만든 'updateUserProfile' 함수를 호출합니다.
 * - 사용자가 수정한 모든 정보를 서버로 전송합니다.
 */
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
    emits('user-updated'); // 부모 컴포넌트에 변경사항 알림
    emits('close');       // 모달 닫기
  } catch (error) {
    console.error("회원 정보 수정 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
};

/**
 * [핵심 수정 4] Firestore 'centers' 컬렉션에서 소속 센터 목록을 불러오는 함수
 */
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

// 컴포넌트가 화면에 나타날 때 센터 목록을 불러옵니다.
onMounted(() => {
  fetchCenters();
});
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
.btn {
  border: none;
  border-radius: 6px;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
  font-size: 1em;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
.btn:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}
</style>