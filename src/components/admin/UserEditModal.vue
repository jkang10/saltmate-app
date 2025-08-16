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
          <label>이메일</label>
          <input type="email" v-model="editableUser.email" />
        </div>
        <div class="form-group">
          <label>소속 센터</label>
          <select v-model="editableUser.centerId">
            <option value="">센터 없음</option>
            <option
              v-for="center in centers"
              :key="center.id"
              :value="center.id"
            >
              {{ center.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>추천인</label>
          <select v-model="editableUser.uplineReferrer">
            <option :value="null">없음 (최상위)</option>
            <option v-for="user in allUsers" :key="user.id" :value="user.id">
              {{ user.name }} ({{ user.email }})
            </option>
          </select>
        </div>
        <footer class="modal-footer">
          <button type="button" class="btn-secondary" @click="$emit('close')">
            취소
          </button>
          <button type="submit" class="btn-primary" :disabled="isSaving">
            <span v-if="isSaving">저장 중...</span>
            <span v-else>저장하기</span>
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, defineProps, defineEmits } from "vue";
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const props = defineProps({
  user: { type: Object, required: true },
  allUsers: { type: Array, required: true },
});
const emit = defineEmits(["close", "user-updated"]);

const editableUser = ref(null);
const centers = ref([]);
const isSaving = ref(false);

onMounted(async () => {
  editableUser.value = { ...props.user };
  const centersSnapshot = await getDocs(collection(db, "centers"));
  centers.value = centersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
});

const saveChanges = async () => {
  isSaving.value = true;
  try {
    const functions = getFunctions();
    const updateUserByAdmin = httpsCallable(functions, "updateUserByAdmin");
    await updateUserByAdmin({
      userId: editableUser.value.id,
      name: editableUser.value.name,
      centerId: editableUser.value.centerId || "",
      referrerId: editableUser.value.uplineReferrer || null,
      email: editableUser.value.email,
    });
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
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
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
.current-balances {
  display: flex;
  gap: 20px;
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 20px;
}
</style>
