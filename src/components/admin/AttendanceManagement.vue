<template>
  <div class="attendance-manager">
    <h2><i class="fas fa-user-check"></i> 출석 현황 관리</h2>
    <p>회원별 출석 현황과 연속 출석 보상 지급 내역을 확인합니다.</p>

    <div class="user-list card">
      <div class="search-bar">
        <input v-model="searchQuery" type="text" placeholder="회원 이름 또는 이메일로 검색..." />
        
        <select v-model.number="consecutiveDaysFilter" class="filter-select">
          <option :value="0">연속 출석일 전체</option>
          <option :value="7">7일 이상</option>
          <option :value="15">15일 이상</option>
          <option :value="30">30일 이상</option>
        </select>
      </div>
      
      <div v-if="loadingUsers" class="loading-spinner"></div>
      <table v-else class="user-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>이메일</th>
            <th>연속 출석</th>
            <th>최근 출석일</th>
            <th>상세 보기</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.attendance?.consecutiveDays || 0 }}일</td>
            <td>{{ user.attendance?.lastCheckIn || '기록 없음' }}</td>
            <td>
              <button @click="showUserDetail(user)" class="btn btn-sm btn-primary">
                현황 보기
              </button>
            </td>
          </tr>
          <tr v-if="filteredUsers.length === 0">
             <td colspan="5" class="no-data">검색 결과가 없습니다.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selectedUser" class="modal-backdrop" @click.self="selectedUser = null">
      </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { db, functions } from '@/firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const users = ref([]);
const loadingUsers = ref(true);
const searchQuery = ref('');
const selectedUser = ref(null);
const detailData = ref(null);
const loadingDetail = ref(false);
const consecutiveDaysFilter = ref(0); // [신규 추가] 필터 상태 변수

const filteredUsers = computed(() => {
  let result = users.value;

  // 1. 이름/이메일 검색 필터
  if (searchQuery.value) {
    const lowerQuery = searchQuery.value.toLowerCase();
    result = result.filter(u => 
      u.name.toLowerCase().includes(lowerQuery) || u.email.toLowerCase().includes(lowerQuery)
    );
  }

  // 2. [신규 추가] 연속 출석일 필터
  if (consecutiveDaysFilter.value > 0) {
    result = result.filter(u => 
      (u.attendance?.consecutiveDays || 0) >= consecutiveDaysFilter.value
    );
  }

  return result;
});

const fetchAllUsers = async () => {
  loadingUsers.value = true;
  try {
    const q = query(collection(db, "users"), orderBy("name"));
    const querySnapshot = await getDocs(q);
    users.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("사용자 목록 로딩 오류:", error);
  } finally {
    loadingUsers.value = false;
  }
};

const showUserDetail = async (user) => {
  selectedUser.value = user;
  loadingDetail.value = true;
  try {
    const getUserAttendanceData = httpsCallable(functions, 'getUserAttendanceData');
    const result = await getUserAttendanceData({ userId: user.id });
    detailData.value = result.data;
  } catch (error) {
    console.error("상세 데이터 조회 오류:", error);
    alert("상세 정보를 불러오는 데 실패했습니다.");
    selectedUser.value = null;
  } finally {
    loadingDetail.value = false;
  }
};

onMounted(fetchAllUsers);
</script>

<style scoped>
.search-bar {
  margin-bottom: 20px;
  display: flex; /* [수정] flex 레이아웃으로 변경 */
  gap: 15px; /* [수정] 검색창과 필터 사이 간격 */
}
.search-bar input {
  flex-grow: 1; /* [수정] 검색창이 남은 공간을 모두 차지하도록 */
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #ced4da;
  font-size: 1em;
}
.filter-select {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #ced4da;
  font-size: 1em;
  background-color: #fff;
}
.no-data td {
    text-align: center;
    padding: 20px;
    color: #777;
}
.attendance-manager {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.attendance-manager h2 {
  font-size: 1.8em;
  margin: 0 0 10px;
}
.card {
  background-color: #fff;
  padding: 20px 25px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.search-bar {
  margin-bottom: 20px;
}
.search-bar input {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #ced4da;
  font-size: 1em;
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
  to { transform: rotate(360deg); }
}
.user-table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}
.user-table th,
.user-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  text-align: left;
  vertical-align: middle;
}
.user-table th {
  background-color: #f8f9fa;
}
.btn {
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.85em;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-primary:hover {
  background-color: #0056b3;
}
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background-color: white;
  padding: 25px;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  box-shadow: 0 5px 20px rgba(0,0,0,0.2);
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
}
.close-button {
  background: none;
  border: none;
  font-size: 2em;
  cursor: pointer;
  color: #888;
}
.modal-body p {
  font-size: 1.1em;
  margin-bottom: 10px;
}
.modal-body h4 {
  margin-top: 20px;
  margin-bottom: 10px;
  font-size: 1.2em;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
}
.modal-body ul {
  list-style-type: none;
  padding: 0;
}
.modal-body li {
  background-color: #f8f9fa;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 5px;
}
</style>v