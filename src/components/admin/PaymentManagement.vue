<template>
  <div class="payment-manager">
    <h2><i class="fas fa-money-check-alt"></i> 월간 결제 승인</h2>
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
    <div v-else-if="requests.length === 0" class="empty-state">
      <p>대기 중인 결제 요청이 없습니다.</p>
    </div>
    <div v-else class="table-container">
      <table class="request-table">
        <thead>
          <tr>
            <th>요청일시</th>
            <th>요청자명</th>
            <th>센터</th>
            <th>추천인</th>
            <th>금액</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in requests" :key="req.id">
            <td>{{ formatDate(req.requestedAt) }}</td>
            <td>{{ req.userName }}</td>
            <td>{{ req.centerName || "N/A" }}</td>
            <td>{{ req.referrerName || "없음" }}</td>
            <td>{{ req.amount.toLocaleString() }} 원</td>
            <td>
              <span class="status-badge pending">{{ req.status }}</span>
            </td>
            <td class="actions">
              <button @click="approvePayment(req.id)" class="btn-approve">
                승인
              </button>
              <button @click="deletePayment(req.id)" class="btn-delete">
                삭제
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
  deleteDoc, // [핵심 추가] deleteDoc 함수를 import 합니다.
} from "firebase/firestore";

export default {
  name: "PaymentManagement",
  data() {
    return {
      requests: [],
      isLoading: true,
    };
  },
  async created() {
    await this.fetchRequests();
  },
  methods: {
    // ▼▼▼ [수정됨] fetchRequests 함수 전체를 아래 코드로 교체 ▼▼▼
    async fetchRequests() {
      this.isLoading = true;
      try {
        // 1. 'pending' 상태의 결제 요청, 모든 사용자, 모든 센터 정보를 동시에 가져옵니다.
        const paymentsQuery = query(
          collection(db, "monthly_payments"),
          where("status", "==", "pending"),
          orderBy("requestedAt", "desc"),
        );
        const usersQuery = query(collection(db, "users"));
        const centersQuery = query(collection(db, "centers"));

        const [paymentSnapshot, userSnapshot, centerSnapshot] =
          await Promise.all([
            getDocs(paymentsQuery),
            getDocs(usersQuery),
            getDocs(centersQuery),
          ]);

        // 2. 빠른 조회를 위해 사용자 맵과 센터 맵을 만듭니다.
        const userMap = new Map();
        userSnapshot.forEach((doc) => {
          userMap.set(doc.id, doc.data());
        });

        const centerMap = new Map();
        centerSnapshot.forEach((doc) => {
          centerMap.set(doc.id, doc.data().name);
        });

        // 3. 결제 요청 목록에 센터 이름과 추천인 이름을 추가합니다.
        this.requests = paymentSnapshot.docs.map((doc) => {
          const requestData = doc.data();
          const userInfo = userMap.get(requestData.userId);

          let centerName = "N/A";
          let referrerName = "없음";

          if (userInfo) {
            centerName = centerMap.get(userInfo.centerId) || "N/A";
            if (userInfo.uplineReferrer) {
              const referrerInfo = userMap.get(userInfo.uplineReferrer);
              referrerName = referrerInfo ? referrerInfo.name : "정보 없음";
            }
          }

          return {
            id: doc.id,
            ...requestData,
            centerName,
            referrerName,
          };
        });
      } catch (error) {
        console.error("결제 요청 목록 조회 오류:", error);
        alert("데이터를 불러오는 데 실패했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
    // ▲▲▲ 수정 완료 ▲▲▲
    async approvePayment(requestId) {
      if (!confirm("이 결제 요청을 승인하시겠습니까?")) return;
      const reqRef = doc(db, "monthly_payments", requestId);
      try {
        await updateDoc(reqRef, { status: "approved" });
        alert("결제가 승인되었습니다.");
        await this.fetchRequests();
      } catch (error) {
        console.error("결제 승인 오류:", error);
        alert("처리 중 오류가 발생했습니다.");
      }
    },	

    async deletePayment(requestId) {
      if (!confirm("이 결제 요청을 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
      
      const reqRef = doc(db, "monthly_payments", requestId);
      try {
        await deleteDoc(reqRef);
        alert("결제 요청이 삭제되었습니다.");
        // 목록을 다시 불러와 화면을 갱신합니다.
        await this.fetchRequests(); 
      } catch (error) {
        console.error("결제 요청 삭제 오류:", error);
        alert("삭제 처리 중 오류가 발생했습니다.");
      }
    },

    formatDate(timestamp) {
      if (!timestamp?.toDate) return "N/A";
      return timestamp.toDate().toLocaleString("ko-KR");
    },
  },
};
</script>

<style scoped>
.actions button {
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-weight: bold;
  margin: 0 4px; /* [추가] 버튼 사이 간격 */
}
.btn-approve {
  background-color: #007bff;
}
/* [핵심 추가] 삭제 버튼의 스타일을 정의합니다. */
.btn-delete {
  background-color: #dc3545;
}
.payment-manager h2 {
  font-size: 1.8em;
  margin-bottom: 20px;
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
  border-top-color: #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
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
}
.request-table th,
.request-table td {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
  white-space: nowrap;
}
.request-table thead th {
  background-color: #f8f9fa;
}
.status-badge.pending {
  background-color: #ffc107;
  color: #333;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
}
.actions button {
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: white;
  font-weight: bold;
}
.btn-approve {
  background-color: #007bff;
}
</style>
