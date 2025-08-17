// 파일 경로: src/components/admin/EquityGrantModal.vue

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h3>지분 부여/수정</h3>
        <button @click="$emit('close')" class="close-button">&times;</button>
      </header>
      <form class="modal-body" @submit.prevent="updateEquity">
        <div class="form-group">
          <label>대상 회원</label>
          <select v-model="form.userId" required :disabled="!!targetUser">
            <option disabled value="">회원을 선택하세요</option>
            <option v-for="user in allUsers" :key="user.id" :value="user.id">
              {{ user.name }} ({{ user.email }})
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>지분 종류</label>
          <select v-model="form.equityType" required>
            <option disabled value="">지분 종류를 선택하세요</option>
            <option
              v-for="type in equityTypes"
              :key="type.id"
              :value="type.name"
            >
              {{ type.name }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label>새 지분율 (%)</label>
          <input
            type="number"
            v-model.number="form.newPercentage"
            min="0"
            step="0.0001"
            required
          />
        </div>
        <div class="form-group">
          <label>사유</label>
          <input
            type="text"
            v-model="form.reason"
            placeholder="예: 1호 NFT 구매 보상"
            required
          />
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
import { ref, onMounted, reactive, defineProps, defineEmits } from "vue";
import { db } from "@/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const props = defineProps({ targetUser: { type: Object, default: null } });
const emit = defineEmits(["close", "equity-updated"]);

const form = reactive({
  userId: "",
  equityType: "",
  newPercentage: null,
  reason: "",
});
const allUsers = ref([]);
const equityTypes = ref([]); // [추가됨]
const isSaving = ref(false);

onMounted(async () => {
  // 전체 사용자 목록 불러오기
  const usersSnapshot = await getDocs(collection(db, "users"));
  allUsers.value = usersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // [추가됨] 지분 종류 목록 불러오기
  const equityTypesSnapshot = await getDocs(collection(db, "equityTypes"));
  equityTypes.value = equityTypesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // '지분 수정' 모드일 경우
  if (props.targetUser) {
    form.userId = props.targetUser.userId;
    const firstType = Object.keys(props.targetUser.types)[0];
    if (firstType) {
      form.equityType = firstType;
      form.newPercentage = props.targetUser.types[firstType];
    }
  }
});

const updateEquity = async () => {
  if (!form.userId || !form.equityType || form.newPercentage === null) {
    alert("모든 필드를 입력해주세요.");
    return;
  }
  isSaving.value = true;
  try {
    const functions = getFunctions();
    const updateUserEquity = httpsCallable(functions, "updateUserEquity");

    // ▼▼▼ [수정됨] 오류 해결을 위해 순수 JavaScript 객체로 변환하여 전달 ▼▼▼
    const payload = {
      userId: form.userId,
      equityType: form.equityType,
      newPercentage: form.newPercentage,
      reason: form.reason,
    };
    await updateUserEquity(payload);
    // ▲▲▲ 수정 완료 ▲▲▲

    alert("지분 정보가 성공적으로 업데이트되었습니다.");
    emit("equity-updated");
    emit("close");
  } catch (error) {
    console.error("지분 업데이트 실패:", error);
    alert(`오류가 발생했습니다: ${error.message}`);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
/* 스타일은 이전과 동일하므로 생략하지 않고 모두 포함합니다. */
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
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  font-weight: bold;
  margin-bottom: 5px;
}
.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
</style>
