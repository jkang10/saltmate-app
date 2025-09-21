<template>
  <div class="user-management">
    <h3><i class="fas fa-users-cog"></i> 회원 관리</h3>
    <p>회원 목록을 조회하고 사용자 잔액, 토큰 및 권한을 관리합니다.</p>

    <div class="user-summary-container">
      <div class="summary-card total"><div class="card-icon"><i class="fas fa-users"></i></div><div class="card-content"><span class="card-title">총 회원수</span><span class="card-value">{{ totalUserCount }} 명</span></div></div>
      <div class="summary-card active"><div class="card-icon"><i class="fas fa-user-check"></i></div><div class="card-content"><span class="card-title">승인 완료 회원</span><span class="card-value">{{ activeUserCount }} 명</span></div></div>
      <div class="summary-card pending"><div class="card-icon"><i class="fas fa-user-clock"></i></div><div class="card-content"><span class="card-title">처리할 승인 요청</span><span class="card-value">{{ pendingRequestCount }} 건</span></div></div>
    </div>

    <div class="filter-controls">
      <input type="text" v-model="searchTerm" placeholder="이름 또는 이메일로 검색..." class="search-input" />
      <select v-model="itemsPerPage" class="items-per-page-select">
        <option value="10">10개씩 보기</option><option value="20">20개씩 보기</option><option value="30">30개씩 보기</option>
        <option value="40">40개씩 보기</option><option value="50">50개씩 보기</option>
      </select>
    </div>

    <div v-if="loading" class="loading-spinner"></div>
    <div v-if="error" class="error-state"><p>{{ error }}</p></div>
    <div v-if="!loading && paginatedUsers.length > 0" class="table-container">
      <table class="user-table">
        <thead>
          <tr>
            <th>이름</th><th>이메일</th><th>센터</th><th>추천인</th><th>역할</th>
            <th>가입일</th><th>다음 결제일</th><th>구독 상태</th><th>솔트메이트</th><th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in paginatedUsers" :key="user.id" :class="{ 'not-approved-row': user.subscriptionStatus !== 'active' }">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.centerName || "N/A" }}</td>
            <td>{{ user.referrerName || "없음" }}</td>
            <td><span :class="['role-badge', user.role]">{{ formatRole(user.role) }}</span></td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>{{ formatDate(user.nextPaymentDueDate) }}</td>
            <td><span :class="['status-badge', user.subscriptionStatus]">{{ formatSubscriptionStatus(user.subscriptionStatus) }}</span></td>
            <td>{{ (user.saltmatePoints || 0).toLocaleString() }} P</td>
            <td class="actions">
              <button @click="openEditModal(user)" class="btn btn-sm btn-primary">수정</button>
              <button @click="openBalanceModal(user)" class="btn btn-sm btn-success">잔액 조정</button>
              <button @click="openTokenModal(user)" class="btn btn-sm btn-info">토큰 관리</button>
              <button @click="deleteUser(user)" class="btn btn-sm btn-danger">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
<div v-if="!loading && users.length === 0" class="no-data"><p>표시할 사용자가 없습니다.</p></div>

<div v-if="!loading && (currentPage > 1 || totalPages > currentPage)" class="pagination">
  <button @click="goToPage(currentPage - 1)" :disabled="currentPage === 1">이전</button>
  <span>{{ currentPage }} / {{ totalPages > currentPage ? '...' : totalPages }}</span>
  <button @click="goToPage(currentPage + 1)" :disabled="totalPages <= currentPage">다음</button>
</div>
    <TokenTransferModal v-if="isTokenModalVisible" :user="selectedUser" @close="isTokenModalVisible = false" @token-updated="fetchUsers" />
    <BalanceAdjustmentModal v-if="isBalanceModalVisible" :user="selectedUser" @close="isBalanceModalVisible = false" @balance-updated="fetchUsers" />
    <UserEditModal v-if="isEditModalVisible" :user="selectedUser" :allUsers="users" @close="isEditModalVisible = false" @user-updated="fetchUsers" />
  </div>
</template>

<script setup>

import { ref, onMounted, computed, watch } from "vue";
import { db, functions } from "@/firebaseConfig"; // functions import 확인
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import TokenTransferModal from "./TokenTransferModal.vue";
import BalanceAdjustmentModal from "./BalanceAdjustmentModal.vue";
import UserEditModal from "./UserEditModal.vue";

const users = ref([]);
const loading = ref(true);
const error = ref(null);
const searchTerm = ref("");
const searchCriteria = ref("name"); // 기본 검색 기준
const currentPage = ref(1);
const itemsPerPage = ref(10);
const pageTokens = ref(['']); // 페이지 토큰 저장 배열, 첫 페이지는 빈 토큰
const totalPages = ref(1); // 총 페이지 수 (더 이상 사용하지 않지만 UI 호환성을 위해 유지)

const isTokenModalVisible = ref(false);
const isBalanceModalVisible = ref(false);
const isEditModalVisible = ref(false);
const selectedUser = ref(null);
const pendingRequestCount = ref(0);
const totalUserCount = ref(0);
const activeUserCount = ref(0);

// 검색어가 변경되면 첫 페이지로 리셋
let searchTimeout = null;
watch(searchTerm, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage.value = 1;
    pageTokens.value = [''];
    fetchUsers();
  }, 500); // 0.5초 디바운스
});

// 페이지당 항목 수가 변경되면 첫 페이지로 리셋
watch(itemsPerPage, () => {
  currentPage.value = 1;
  pageTokens.value = [''];
  fetchUsers();
});

// [핵심 수정] 서버에서 데이터를 가져오는 새로운 fetchUsers 함수
const fetchUsers = async () => {
  loading.value = true;
  error.value = null;
  try {
    const listUsersFunc = httpsCallable(functions, "listAllUsers");
    const result = await listUsersFunc({
      pageToken: pageTokens.value[currentPage.value - 1],
      usersPerPage: parseInt(itemsPerPage.value),
      // 검색어가 있을 때만 검색 조건을 보냄
      ...(searchTerm.value.trim() && { 
          searchCriteria: searchCriteria.value, 
          filterValue: searchTerm.value.trim() 
      })
    });

    const { users: fetchedUsers, nextPageToken } = result.data;
    
    // 센터 및 추천인 이름 정보 추가
    const centerIds = [...new Set(fetchedUsers.map(u => u.centerId).filter(Boolean))];
    const referrerIds = [...new Set(fetchedUsers.map(u => u.uplineReferrer).filter(Boolean))];
    const allIds = [...new Set([...centerIds, ...referrerIds])];

    const centerMap = new Map();
    if (centerIds.length > 0) {
        const centersSnapshot = await getDocs(query(collection(db, "centers"), where('__name__', 'in', centerIds)));
        centersSnapshot.forEach(doc => centerMap.set(doc.id, doc.data().name));
    }
    
    const userMap = new Map();
    if (referrerIds.length > 0) {
        const usersSnapshot = await getDocs(query(collection(db, "users"), where('__name__', 'in', referrerIds)));
        usersSnapshot.forEach(doc => userMap.set(doc.id, doc.data().name));
    }

    users.value = fetchedUsers.map(user => ({
        ...user,
        id: user.uid, // id 필드를 uid로 통일
        centerName: centerMap.get(user.centerId) || "N/A",
        referrerName: userMap.get(user.uplineReferrer) || "없음",
    }));

    // 다음 페이지 토큰 저장
    if (nextPageToken && pageTokens.value.length === currentPage.value) {
      pageTokens.value.push(nextPageToken);
    }
    // 더 이상 다음 페이지가 없으면 마지막 페이지로 설정
    if (!nextPageToken) {
      totalPages.value = currentPage.value;
    } else {
      // 다음 페이지가 있을 수 있으므로 현재 페이지 +1로 설정 (추정치)
      totalPages.value = currentPage.value + 1;
    }

  } catch (err) {
    console.error("사용자 정보 로딩 오류:", err);
    error.value = `사용자 정보를 불러오는 데 실패했습니다: ${err.message}`;
    users.value = [];
  } finally {
    loading.value = false;
  }
};

const fetchSummaryCounts = async () => {
    // 요약 정보는 전체 데이터를 가져와야 하므로 별도로 처리
    try {
        const usersQuery = query(collection(db, "users"));
        const pendingRequestsQuery = query(collection(db, "subscription_requests"), where("status", "==", "pending"));
        const [userSnapshot, pendingRequestsSnapshot] = await Promise.all([
            getDocs(usersQuery),
            getDocs(pendingRequestsSnapshot),
        ]);
        
        totalUserCount.value = userSnapshot.size;
        activeUserCount.value = userSnapshot.docs.filter(doc => {
            const status = doc.data().subscriptionStatus;
            return status === "active" || status === "overdue";
        }).length;
        pendingRequestCount.value = pendingRequestsSnapshot.size;
    } catch(err) {
        console.error("요약 정보 로딩 오류:", err);
    }
};

const goToPage = (page) => {
  if (page < 1 || (page > currentPage.value && page > totalPages.value)) return;
  currentPage.value = page;
  fetchUsers();
}

// 기존 헬퍼 함수들은 그대로 유지
const formatDate = (timestamp) => {
  if (!timestamp) return "정보 없음";
  // 백엔드에서 오는 포맷(ISO String)과 Firestore 포맷(Timestamp) 모두 처리
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("ko-KR");
};

const formatSubscriptionStatus = (status) => {
  const statuses = { active: "승인 완료", pending: "승인 대기", overdue: "연체" };
  return statuses[status] || "미승인";
};

const formatRole = (role) => {
    const roles = {
        superAdmin: '최고 관리자',
        centerManager: '센터 관리자',
        user: '일반 사용자'
    };
    return roles[role] || role || '일반 사용자';
};

const deleteUser = async (user) => {
  if (!confirm(`정말로 '${user.name}' 사용자를 삭제하시겠습니까? 이 작업은 복구할 수 없습니다.`)) return;
  try {
    const deleteUserFunc = httpsCallable(functions, "deleteUser");
    await deleteUserFunc({ uid: user.id });
    alert("사용자가 성공적으로 삭제되었습니다.");
    // 목록 즉시 갱신
    fetchUsers();
    fetchSummaryCounts();
  } catch (error) {
    console.error("사용자 삭제 중 오류 발생:", error);
    alert(`사용자 삭제에 실패했습니다: ${error.message}`);
  }
};

const openTokenModal = (user) => { selectedUser.value = user; isTokenModalVisible.value = true; };
const openBalanceModal = (user) => { selectedUser.value = user; isBalanceModalVisible.value = true; };
const openEditModal = (user) => { selectedUser.value = user; isEditModalVisible.value = true; };

onMounted(() => {
    fetchUsers();
    fetchSummaryCounts(); // 요약 정보는 페이지 로드 시 한 번만 가져옴
});

</script>

<style scoped>
.role-badge { padding: 4px 10px; border-radius: 15px; font-size: 0.8em; font-weight: bold; color: #fff; display: inline-block; }
.role-badge.superAdmin { background-color: #dc3545; }
.role-badge.centerManager { background-color: #17a2b8; }
.role-badge.user, .role-badge.undefined { background-color: #6c757d; }
.user-summary-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}
.summary-card {
  display: flex;
  align-items: center;
  padding: 20px;
  border-radius: 12px;
  color: white;
}
.summary-card.total {
  background: linear-gradient(135deg, #4e54c8, #8f94fb);
}
.summary-card.active {
  background: linear-gradient(135deg, #1d976c, #93f9b9);
}
.summary-card.pending {
  background: linear-gradient(135deg, #ff9a9e, #fecfef);
}

.summary-card .card-icon {
  font-size: 2.5em;
  margin-right: 20px;
  opacity: 0.8;
}
.summary-card .card-content {
  display: flex;
  flex-direction: column;
}
.summary-card .card-title {
  font-size: 1em;
  opacity: 0.9;
}
.summary-card .card-value {
  font-size: 2em;
  font-weight: bold;
}
.user-table tbody .not-approved-row {
  background-color: #fff5f5;
}
.user-management {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.user-management h3 {
  margin-top: 0;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-controls {
  margin-bottom: 20px;
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}
.search-input {
  padding: 10px 15px;
  border-radius: 8px;
  border: 1px solid #ccc;
  width: 100%;
  max-width: 400px;
  font-size: 1em;
}
.items-per-page-select {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 1em;
  background-color: white;
}
.table-container {
  overflow-x: auto;
}
.user-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
  font-size: 0.9em;
}
.user-table th,
.user-table td {
  border-bottom: 1px solid #eee;
  padding: 8px 10px;
  text-align: center;
  vertical-align: middle;
  white-space: nowrap;
}
.user-table th {
  background-color: #f8f9fa;
  font-weight: 600;
  color: #555;
}
.admin-badge,
.user-badge,
.status-badge {
  padding: 4px 10px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: bold;
  color: #fff;
  display: inline-block;
}
.admin-badge {
  background-color: #dc3545;
}
.user-badge {
  background-color: #007bff;
}
.status-badge.active {
  background-color: #28a745;
}
.status-badge.pending {
  background-color: #ffc107;
  color: #212529;
}
.status-badge.overdue {
  background-color: #dc3545;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: center;
}
.btn {
  border: none;
  border-radius: 5px;
  padding: 5px 10px;
  cursor: pointer;
  transition: opacity 0.2s;
  font-weight: 500;
  min-width: 60px;
}
.btn:hover {
  opacity: 0.8;
}
.btn-sm {
  font-size: 0.85em;
}
.btn-primary {
  background-color: #0d6efd;
  color: white;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.btn-info {
  background-color: #0dcaf0;
  color: white;
}
.btn-success {
  background-color: #198754;
  color: white;
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
.no-data,
.error-state {
  text-align: center;
  padding: 50px;
  color: #777;
}
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}
.pagination button {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #ddd;
  background-color: #fff;
  cursor: pointer;
}
.pagination button:disabled {
  background-color: #f8f9fa;
  cursor: not-allowed;
  opacity: 0.5;
}
.pagination span {
  font-weight: bold;
}
</style>
