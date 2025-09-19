<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card" v-if="editableUser">
      <header class="modal-header">
        <h3><i class="fas fa-edit"></i> {{ editableUser.name }}님 정보 수정</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>
      <form class="modal-body" @submit.prevent="saveChanges">
        <div class="form-group">
          <label>이름</label>
          <input type="text" v-model="editableUser.name" />
        </div>
        <div class="form-group">
          <label>이메일 (수정 불가)</label>
          <input type="email" :value="editableUser.email" disabled />
        </div>
        <div class="form-group">
          <label>역할</label>
          <select v-model="editableUser.role">
            <option value="user">일반 사용자</option>
            <option value="centerManager">센터 관리자</option>
            <option value="superAdmin">최고 관리자</option>
          </select>
        </div>
        <div v-if="editableUser.role === 'centerManager'" class="form-group">
          <label>담당 센터</label>
          <select v-model="editableUser.managedCenterId">
            <option :value="null">센터를 선택하세요</option>
            <option v-for="center in centers" :key="center.id" :value="center.id">
              {{ center.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>소속 센터</label>
          <select v-model="editableUser.centerId">
            <option :value="null">센터 없음</option>
            <option v-for="center in centers" :key="center.id" :value="center.id">
              {{ center.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>추천인</label>
          <select v-model="editableUser.uplineReferrer">
            <option :value="null">없음 (최상위)</option>
            <option v-for="u in allUsers.filter(u => u.id !== editableUser.id)" :key="u.id" :value="u.id">
              {{ u.name }} ({{ u.email }})
            </option>
          </select>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn-secondary" @click="$emit('close')">취소</button>
          <button type="submit" class="btn-primary" :disabled="isSaving">
            <span v-if="isSaving" class="spinner-small"></span>
            <span v-else>저장하기</span>
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits, reactive } from "vue";
import { db, functions } from "@/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const props = defineProps({
  user: { type: Object, required: true },
  allUsers: { type: Array, required: true },
});
const emit = defineEmits(["close", "user-updated"]);

const editableUser = reactive({ ...props.user });
const centers = ref([]);
const isSaving = ref(false);

onMounted(async () => {
  const centersSnapshot = await getDocs(query(collection(db, "centers"), orderBy("name")));
  centers.value = centersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
});

const saveChanges = async () => {
  if (editableUser.role === 'centerManager' && !editableUser.managedCenterId) {
    return alert("센터 관리자 역할을 지정하려면 반드시 담당 센터를 선택해야 합니다.");
  }

  isSaving.value = true;
  try {
    const updateUserByAdmin = httpsCallable(functions, "updateUserByAdmin");
    
    // 서버로 보낼 데이터 정제
    const payload = {
      uid: editableUser.id,
      name: editableUser.name,
      centerId: editableUser.centerId || null,
      uplineReferrer: editableUser.uplineReferrer || null,
      role: editableUser.role || 'user',
      // 센터 관리자가 아닐 경우 managedCenterId를 null로 보냄
      managedCenterId: editableUser.role === 'centerManager' ? editableUser.managedCenterId : null,
    };

    await updateUserByAdmin(payload);
    
    alert("회원 정보가 수정되었습니다.");
    emit("user-updated");
    emit("close");
  } catch (error) {
    console.error("회원 정보 수정 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1001; }
.modal-content { width: 90%; max-width: 500px; background-color: #fff; border-radius: 12px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; border-bottom: 1px solid #eee; }
.modal-header h3 { margin: 0; font-size: 1.2em; display: flex; align-items: center; gap: 8px; }
.close-button { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #888; }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; max-height: 70vh; overflow-y: auto; }
.form-group { display: flex; flex-direction: column; }
.form-group label { font-weight: bold; margin-bottom: 5px; font-size: 0.9em; }
.form-group input, .form-group select { padding: 10px; border-radius: 6px; border: 1px solid #ccc; font-size: 1em; }
.form-group input[disabled] { background-color: #f8f9fa; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 15px 20px; border-top: 1px solid #eee; }
.btn-primary, .btn-secondary { padding: 8px 15px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; }
.btn-primary { background-color: #007bff; color: white; }
.btn-primary:disabled { background-color: #a0c9ff; }
.btn-secondary { background-color: #6c757d; color: white; }
.spinner-small { border: 2px solid rgba(255, 255, 255, 0.3); border-top: 2px solid #fff; border-radius: 50%; width: 16px; height: 16px; display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>