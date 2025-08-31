<template>
  <div class="management-container">
    <h3><i class="fas fa-gift"></i> 쿠폰 발급 관리</h3>
    <p>특정 사용자 또는 모든 사용자에게 게임 부스트 쿠폰을 발급합니다.</p>

    <div class="coupon-form card">
      <h4>신규 쿠폰 발급</h4>
      <form @submit.prevent="issueCoupons">
        <div class="form-group">
          <label for="user-select">대상 사용자</label>
          <select id="user-select" v-model="targetUser" required>
            <option value="all">모든 사용자</option>
            <option v-for="user in userList" :key="user.id" :value="user.id">
              {{ user.name }} ({{ user.email }})
            </option>
          </select>
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
        <button type="submit" class="btn btn-primary" :disabled="isIssuing">
          <span v-if="isIssuing" class="spinner-small"></span>
          <span v-else>쿠폰 발급</span>
        </button>
      </form>
    </div>

    <div class="coupon-list-container card">
        <h4><i class="fas fa-history"></i> 발급된 쿠폰 내역</h4>
        <div v-if="isLoadingCoupons" class="loading-spinner"></div>
        <table v-else-if="issuedCoupons.length > 0" class="event-table">
            <thead>
                <tr>
                    <th>발급 대상</th>
                    <th>이벤트 내용</th>
                    <th>효과</th>
                    <th>상태</th>
                    <th>발급일</th>
                    <th>만료일</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="coupon in issuedCoupons" :key="coupon.id">
                    <td>{{ coupon.userName }}</td>
                    <td>{{ coupon.description }}</td>
                    <td>+{{ coupon.boostPercentage }}% ({{ coupon.durationMinutes }}분)</td>
                    <td>
                        <span class="status-badge" :class="`status-${coupon.status}`">
                            {{ formatCouponStatus(coupon.status) }}
                        </span>
                    </td>
                    <td>{{ formatDate(coupon.issuedAt) }}</td>
                    <td>{{ formatDate(coupon.expiresAt) }}</td>
                </tr>
            </tbody>
        </table>
        <div v-else class="no-data">
            <p>아직 발급된 쿠폰이 없습니다.</p>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { db, functions } from "@/firebaseConfig";
import { collection, getDocs, query, orderBy, collectionGroup } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const userList = ref([]);
const targetUser = ref("all");
const isIssuing = ref(false);
const couponDetails = reactive({
  boostPercentage: 20,
  durationMinutes: 60,
  description: '', // [신규] 이벤트 내용 데이터
});

const issuedCoupons = ref([]);
const isLoadingCoupons = ref(true);

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return "N/A";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

const formatCouponStatus = (status) => {
    switch(status) {
        case 'unused': return '미사용';
        case 'used': return '사용 완료';
        case 'expired': return '기간 만료';
        default: return status;
    }
};

const fetchUsers = async () => {
  try {
    const q = query(collection(db, "users"), orderBy("name"));
    const querySnapshot = await getDocs(q);
    userList.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("사용자 목록 로딩 실패:", error);
  }
};

const fetchIssuedCoupons = async () => {
    isLoadingCoupons.value = true;
    try {
        const q = query(collectionGroup(db, 'coupons'), orderBy('issuedAt', 'desc'));
        const couponSnapshot = await getDocs(q);
        
        const usersSnapshot = await getDocs(collection(db, "users"));
        const userMap = new Map(usersSnapshot.docs.map(doc => [doc.id, doc.data().name]));

        issuedCoupons.value = couponSnapshot.docs.map(doc => {
            const data = doc.data();
            const userId = doc.ref.parent.parent.id;
            return {
                id: doc.id,
                ...data,
                userName: userMap.get(userId) || '알 수 없음',
            }
        });
    } catch (error) {
        console.error("발급된 쿠폰 목록 로딩 실패:", error);
    } finally {
        isLoadingCoupons.value = false;
    }
};

const issueCoupons = async () => {
  if (!couponDetails.description) {
    return alert("이벤트 내용을 입력해주세요.");
  }
  if (!confirm("선택한 조건으로 쿠폰을 발급하시겠습니까?")) return;
  
  isIssuing.value = true;
  try {
    let userIds = [];
    if (targetUser.value === 'all') {
      userIds = userList.value.map(user => user.id);
    } else {
      userIds.push(targetUser.value);
    }

    const issueCouponsToUser = httpsCallable(functions, "issueCouponsToUser");
    const result = await issueCouponsToUser({
      userIds,
      couponType: 'SALT_MINE_BOOST',
      boostPercentage: couponDetails.boostPercentage,
      durationMinutes: couponDetails.durationMinutes,
      description: couponDetails.description, // [신규] 이벤트 내용 전달
    });
    
    alert(result.data.message);
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
