<template>
  <div class="management-container">
    <h3><i class="fas fa-gift"></i> 쿠폰 발급 관리</h3>
    <p>특정 사용자 또는 모든 사용자에게 게임 부스트 쿠폰을 발급합니다.</p>

    <div class="coupon-form card">
      <h4>신규 쿠폰 발급</h4>
      <form @submit.prevent="issueCoupons">
        <div class="form-group">
          <label>대상 사용자 ({{ selectedUsers.length }}명 선택됨)</label>
          <div class="user-selection-table">
            <div class="table-header">
              <input type="checkbox" @change="selectAllUsers" :checked="isAllUsersSelected" />
              <span>전체 선택</span>
            </div>
            <div class="user-list">
              <div v-for="user in userList" :key="user.id" class="user-row">
                <input type="checkbox" :value="user.id" v-model="selectedUsers" />
                <span class="user-name">{{ user.name }}</span>
                <span class="user-email">{{ user.email }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label for="description">이벤트 내용 (발급 사유)</label>
          <textarea id="description" v-model="couponDetails.description" rows="3" placeholder="예: 서비스 오픈 기념 이벤트"></textarea>
        </div>
        <div class="form-group">
          <label for="coupon-type">쿠폰 종류</label>
          <input type="text" id="coupon-type" value="소금 광산 채굴 부스트" disabled />
        </div>
        <div class="form-group-inline">
          <div class="form-group">
            <label for="boost-percentage">부스트 비율 (%)</label>
            <select id="boost-percentage" v-model="couponDetails.boostPercentage" required>
              <option value="20">20%</option>
              <option value="40">40%</option>
              <option value="60">60%</option>
              <option value="80">80%</option>
              <option value="100">100%</option>
            </select>
          </div>
          <div class="form-group">
            <label for="duration">지속 시간 (분)</label>
            <input type="number" id="duration" v-model="couponDetails.durationMinutes" required min="1" placeholder="예: 60" />
          </div>
        </div>
        <button type="submit" class="btn btn-primary" :disabled="isIssuing || selectedUsers.length === 0">
          <span v-if="isIssuing" class="spinner-small"></span>
          <span v-else>선택한 사용자에게 쿠폰 발급</span>
        </button>
      </form>
    </div>

    <div class="coupon-list-container card">
        <h4><i class="fas fa-history"></i> 발급된 쿠폰 내역</h4>
        </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from "vue";
import { db, functions } from "@/firebaseConfig";
import { collection, getDocs, query, orderBy, collectionGroup } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const userList = ref([]);
const isIssuing = ref(false);
const couponDetails = reactive({
  boostPercentage: 20,
  durationMinutes: 60,
  description: '',
});

// [핵심 수정] 단일 선택(targetUser)에서 다중 선택(selectedUsers)으로 변경
const selectedUsers = ref([]); 

const issuedCoupons = ref([]);
const isLoadingCoupons = ref(true);

// [신규] 전체 선택 체크박스 상태 계산
const isAllUsersSelected = computed(() => {
    return userList.value.length > 0 && selectedUsers.value.length === userList.value.length;
});

// [신규] 전체 선택/해제 로직
const selectAllUsers = (event) => {
    if (event.target.checked) {
        selectedUsers.value = userList.value.map(user => user.id);
    } else {
        selectedUsers.value = [];
    }
};

const formatDate = (timestamp) => { /* (기존과 동일) */ };
const formatCouponStatus = (status) => { /* (기존과 동일) */ };

const fetchUsers = async () => {
  try {
    const q = query(collection(db, "users"), orderBy("name"));
    const querySnapshot = await getDocs(q);
    userList.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("사용자 목록 로딩 실패:", error);
  }
};

const fetchIssuedCoupons = async () => { /* (기존과 동일) */ };

const issueCoupons = async () => {
  if (selectedUsers.value.length === 0) {
    return alert("쿠폰을 발급할 사용자를 선택해주세요.");
  }
  if (!couponDetails.description) {
    return alert("이벤트 내용을 입력해주세요.");
  }
  if (!confirm(`${selectedUsers.value.length}명의 사용자에게 쿠폰을 발급하시겠습니까?`)) return;
  
  isIssuing.value = true;
  try {
    const issueCouponsToUser = httpsCallable(functions, "issueCouponsToUser");
    const result = await issueCouponsToUser({
      userIds: selectedUsers.value, // [수정] 선택된 사용자 ID 배열 전달
      couponType: 'SALT_MINE_BOOST',
      boostPercentage: couponDetails.boostPercentage,
      durationMinutes: couponDetails.durationMinutes,
      description: couponDetails.description,
    });
    
    alert(result.data.message);
    selectedUsers.value = []; // 발급 후 선택 초기화
    await fetchIssuedCoupons();
  } catch (error) {
    console.error("쿠폰 발급 실패:", error);
    alert(`오류: ${error.message}`);
  } finally {
    isIssuing.value = false;
  }
};

onMounted(() => {
    fetchUsers();
    fetchIssuedCoupons();
});
</script>

<style scoped>
/* [신규 추가] 사용자 선택 테이블 스타일 */
.user-selection-table {
    border: 1px solid #ddd;
    border-radius: 8px;
    max-height: 250px;
    overflow-y: auto;
}
.table-header {
    background-color: #f8f9fa;
    padding: 10px 15px;
    border-bottom: 1px solid #ddd;
    font-weight: bold;
}
.table-header input, .user-row input {
    margin-right: 10px;
}
.user-list {
    display: flex;
    flex-direction: column;
}
.user-row {
    padding: 10px 15px;
    border-bottom: 1px solid #eee;
}
.user-row:last-child {
    border-bottom: none;
}
.user-name {
    font-weight: 500;
}
.user-email {
    color: #6c757d;
    margin-left: 10px;
    font-size: 0.9em;
}
/* 이전 컴포넌트들과 유사한 스타일 */
.management-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.card {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3,
h4 {
  margin-top: 0;
}

/* 이벤트 생성 폼 */
.event-form .form-group {
  margin-bottom: 20px;
}
.event-form .form-group-inline {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}
.event-form .form-group-inline .form-group {
  flex: 1;
  margin-bottom: 0;
}
.event-form label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}
.event-form input,
.event-form textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1em;
  box-sizing: border-box;
}

/* 이벤트 목록 테이블 */
.event-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.event-table th,
.event-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
}

/* 상태 배지 */
.status-badge {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: bold;
  color: #fff;
}
.status-ongoing {
  background-color: #28a745;
}
.status-ended {
  background-color: #6c757d;
}
.status-upcoming {
  background-color: #17a2b8;
}

/* 공용 버튼 및 로딩 스타일 */
.btn {
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.btn-success {
  background-color: #28a745;
  color: white;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.85em;
  margin-right: 5px;
}
.loading-spinner,
.no-data {
  text-align: center;
  padding: 50px;
  color: #777;
}
.loading-spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #007bff;
  animation: spin 1s ease infinite;
  margin: 50px auto;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.status-badge.status-unused { background-color: #28a745; }
.status-badge.status-used { background-color: #6c757d; }
.status-badge.status-expired { background-color: #dc3545; }
</style>
