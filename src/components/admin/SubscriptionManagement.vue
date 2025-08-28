<template>
  <div class="subscription-manager">
    <h2><i class="fas fa-check-double"></i> 구독 승인 관리</h2>

    <div class="search-bar card">
      <i class="fas fa-search"></i>
      <input
        type="text"
        v-model="searchQuery"
        placeholder="회원 이름으로 검색..."
      />
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
    <div v-else-if="filteredRequests.length === 0" class="empty-state">
      <p>대기 중인 승인 요청이 없거나 검색 결과가 없습니다.</p>
    </div>
    <div v-else class="table-container">
      <table class="request-table">
        <thead>
          <tr>
            <th>신청일시</th>
            <th>신청자명</th>
            <th>센터</th>
            <th>요청 유형</th>
            <th>신청 등급</th>
            <th>금액</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in filteredRequests" :key="req.id">
            <td>{{ formatDate(req.createdAt) }}</td>
            <td>{{ req.userName }}</td>
            <td>{{ req.centerName || "정보 없음" }}</td>
            <td>
              <span :class="['request-type-badge', req.requestType]">{{
                formatRequestType(req.requestType)
              }}</span>
            </td>
            <td>{{ req.requestedTierName }}</td>
            <td>{{ req.requestedAmount.toLocaleString() }} 원</td>
            <td>
              <span :class="['status-badge', req.status]">{{
                req.status
              }}</span>
            </td>
            <td class="actions">
              <button
                @click="updateRequestStatus(req.id, 'approved')"
                class="btn-approve"
              >
                승인
              </button>
              <button
                @click="updateRequestStatus(req.id, 'rejected')"
                class="btn-reject"
              >
                거절
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  orderBy,
  documentId,
} from "firebase/firestore";

export default {
  name: "SubscriptionManager",
  data() {
    return {
      requests: [],
      isLoading: true,
      searchQuery: "",
    };
  },
  computed: {
    filteredRequests() {
      if (!this.searchQuery) {
        return this.requests;
      }
      return this.requests.filter((req) =>
        req.userName.toLowerCase().includes(this.searchQuery.toLowerCase()),
      );
    },
  },
  async created() {
    await this.fetchRequests();
  },
  methods: {
    async fetchRequests() {
      this.isLoading = true;
      try {
        const q = query(
          collection(db, "subscription_requests"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        );
        const requestSnapshot = await getDocs(q);
        let pendingRequests = requestSnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        if (pendingRequests.length > 0) {
          const userIds = [
            ...new Set(pendingRequests.map((req) => req.userId)),
          ];
          const usersQuery = query(
            collection(db, "users"),
            where(documentId(), "in", userIds),
          );
          const usersSnapshot = await getDocs(usersQuery);
          const userCenterMap = new Map(
            usersSnapshot.docs.map((userDoc) => [
              userDoc.id,
              userDoc.data().centerId,
            ]),
          );

          const centerIds = [
            ...new Set(Array.from(userCenterMap.values())),
          ].filter((id) => !!id);
          const centerNameMap = new Map();
          if (centerIds.length > 0) {
            const centersQuery = query(
              collection(db, "centers"),
              where(documentId(), "in", centerIds),
            );
            const centersSnapshot = await getDocs(centersQuery);
            centersSnapshot.forEach((centerDoc) =>
              centerNameMap.set(centerDoc.id, centerDoc.data().name),
            );
          }

          pendingRequests = pendingRequests.map((req) => {
            const centerId = userCenterMap.get(req.userId);
            const centerName = centerNameMap.get(centerId);
            return { ...req, centerName: centerName || "N/A" };
          });
        }
        this.requests = pendingRequests;
      } catch (error) {
        console.error("승인 요청 목록 조회 오류:", error);
        alert("데이터를 불러오는 데 실패했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
    async updateRequestStatus(requestId, status) {
      if (
        !confirm(
          `이 요청을 '${status === "approved" ? "승인" : "거절"}'하시겠습니까?`,
        )
      )
        return;

      const reqRef = doc(db, "subscription_requests", requestId);
      try {
        await updateDoc(reqRef, { status });
        alert(`요청이 성공적으로 처리되었습니다.`);
        await this.fetchRequests();
      } catch (error) {
        console.error("요청 상태 업데이트 오류:", error);
        alert("처리 중 오류가 발생했습니다.");
      }
    },
    formatDate(timestamp) {
      if (!timestamp?.toDate) return "N/A";
      return timestamp.toDate().toLocaleString("ko-KR");
    },
    formatRequestType(type) {
      if (type === "NEW_SIGNUP") return "신규 가입";
      if (type === "UPGRADE") return "등급 추가";
      return type;
    },
  },
};
</script>

<style scoped>
.subscription-manager h2 {
  font-size: 1.8em;
  margin-bottom: 20px;
}
.search-bar {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
}
.search-bar input {
  border: none;
  outline: none;
  width: 100%;
  font-size: 1em;
  background: transparent;
}
.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
.spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.table-container {
  overflow-x: auto;
}
.request-table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
  font-size: 0.95em;
}
.request-table th,
.request-table td {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
}
.request-table thead th {
  background-color: #f8f9fa;
  font-weight: bold;
  color: #333;
}
.status-badge,
.request-type-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
}
.status-badge.pending {
  background-color: #ffc107;
  color: #333;
}
.request-type-badge.NEW_SIGNUP {
  background-color: #17a2b8;
  color: white;
}
.request-type-badge.UPGRADE {
  background-color: #28a745;
  color: white;
}
.actions button {
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin: 0 4px;
  color: white;
  font-weight: bold;
}
.btn-approve {
  background-color: #007bff;
}
.btn-reject {
  background-color: #dc3545;
}
</style>
