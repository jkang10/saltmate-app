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

        <div class="form-section">
          <h4><i class="fas fa-gem"></i> 자동 채굴 설정</h4>
          <div class="form-group">
            <label for="weeklyBndReward">주간 BND 획득량 (최소: 5, 최대: 50)</label>
            <input
              type="number"
              id="weeklyBndReward"
              v-model.number="editableReward"
              class="form-control"
              placeholder="예: 15"
            />
            <button @click="saveTokenMineStats" class="btn btn-secondary" :disabled="isSavingStats" style="margin-top: 10px; width: 100%;">
              <span v-if="isSavingStats" class="spinner-small"></span>
              <span v-else>BND 획득량 저장</span>
            </button>
            <small style="display: block; margin-top: 5px; color: #555;">이 사용자의 주간 자동 채굴 보상(BND) 수량을 설정합니다.</small>
          </div>
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
import { db, functions } from "@/firebaseConfig"; //
import { collection, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions"; //

const props = defineProps({
  user: { type: Object, required: true }, //
  allUsers: { type: Array, default: () => [] }, //
});
const emits = defineEmits(['close', 'user-updated']); //

const localUser = ref({});
const centers = ref([]);
const isSaving = ref(false);
const isIssuingCode = ref(false); //

// [★신규 추가★] 자동 채굴 관련 ref
const editableReward = ref(5); // 기본값 5
const isSavingStats = ref(false);

// [★신규 추가★] admin 함수 호출기 (이전에 생성한 백엔드 함수 이름)
const updateUserRewardFunc = httpsCallable(functions, 'admin_updateUserWeeklyBndReward');

watch(() => props.user, (newUser) => {
  localUser.value = { ...newUser }; //
  
  // [★수정★] watch에 로직 추가: localUser가 변경될 때 editableReward도 갱신
  if (newUser.tokenMineStats && newUser.tokenMineStats.weeklyBndReward) {
    editableReward.value = newUser.tokenMineStats.weeklyBndReward;
  } else {
    editableReward.value = 5; // 설정값이 없으면 기본값 5
  }
}, { immediate: true }); //

const saveUser = async () => {
  isSaving.value = true;
  try {
    const updateUserProfileFunc = httpsCallable(functions, "updateUserProfile"); //
    await updateUserProfileFunc({
      uid: localUser.value.uid,
      name: localUser.value.name,
      role: localUser.value.role,
      uplineReferrer: localUser.value.uplineReferrer || null,
      centerId: localUser.value.centerId || null,
    }); //
    alert("사용자 정보가 성공적으로 업데이트되었습니다.");
    emits('user-updated'); //
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
    const centersSnapshot = await getDocs(collection(db, "centers")); //
    centers.value = centersSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    })); //
  } catch (error) {
    console.error("센터 목록 로딩 실패:", error);
  }
};

onMounted(() => {
  fetchCenters(); //
  // [★수정★] onMounted의 로직은 watch의 { immediate: true }가 대신 처리하므로 여기서 초기화할 필요 없음
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
// [★신규 추가★] BND 획득량 저장 함수
const saveTokenMineStats = async () => {
  if (!confirm(`이 사용자의 주간 BND 획득량을 ${editableReward.value}로 설정하시겠습니까? (서버에서 5~50 사이로 자동 조절됨)`)) {
    return;
  }
  
  isSavingStats.value = true;
  try {
    const result = await updateUserRewardFunc({
      userId: localUser.value.uid, // localUser에서 uid 사용
      newReward: editableReward.value
    });
    alert(result.data.message);
    
    // 부모 컴포넌트(UserManagement)에 변경 사항을 알려 목록을 새로고침하도록 함
    emits('user-updated');
  } catch (error) {
    console.error("BND 획득량 저장 오류:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isSavingStats.value = false;
  }
};

</script>

<style scoped>
/* --- 기존 스타일은 그대로 유지 --- */
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
  /* [★수정★] 내용이 길어질 수 있으므로 스크롤 허용 */
  max-height: 90vh;
  overflow-y: auto;
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

/* [★신규 추가★] 자동 채굴 섹션 구분 */
.form-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee; /* hr 태그 대신 스타일로 구분 */
}
.form-section h4 {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.2rem;
}

/* [★신규 추가★] 로딩 스피너 (DashboardPage.vue 스타일 참고) */
.spinner-small {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
  display: inline-block;
  vertical-align: middle;
  margin-right: 5px;
  margin-bottom: -2px; /* 텍스트와 정렬 */
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>