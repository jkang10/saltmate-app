<template>
  <div class="payout-manager">
    <h2><i class="fas fa-calendar-check"></i> 주간 정산 관리</h2>
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
    <div v-else-if="requests.length === 0" class="empty-state">
      <p>대기 중인 주간 정산 요청이 없습니다.</p>
    </div>
    <div v-else class="table-container">
      <table class="payout-table">
        <thead>
          <tr>
            <th>정산 주차</th>
            <th>회원명</th>
            <th>총 수익(Gross)</th>
            <th>실지급 현금(Net)</th>
            <th>실지급 SaltMate(Net)</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="req in requests" :key="req.id">
            <td>{{ req.weekId }}</td>
            <td>{{ req.userName }}</td>
            <td>
              {{
                req.totalBonus.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })
              }}
              원
            </td>

            <td class="final-amount cash">
              {{
                calculateFinalPayout(req).cash.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })
              }}
              원
            </td>
            <td class="final-amount saltmate">
              {{
                calculateFinalPayout(req).saltmate.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
              }}
              SaltMate
            </td>
            <td class="actions">
              <button @click="approvePayout(req.id)" class="btn-approve">
                승인
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
} from "firebase/firestore";

export default {
  name: "WeeklyPayoutManager",
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
    async fetchRequests() {
      this.isLoading = true;
      try {
        const q = query(
          collection(db, "weekly_payout_requests"),
          where("status", "==", "pending"),
          orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        this.requests = querySnapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
      } catch (error) {
        console.error("주간 정산 목록 조회 오류:", error);
        alert("데이터를 불러오는 데 실패했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
    async approvePayout(payoutId) {
      if (
        !confirm(
          `이 정산 요청을 승인하시겠습니까? 승인 시 즉시 회원에게 수익이 지급됩니다.`,
        )
      )
        return;

      const reqRef = doc(db, "weekly_payout_requests", payoutId);
      try {
        await updateDoc(reqRef, { status: "approved" });
        alert(`정산이 승인되었습니다.`);
        await this.fetchRequests(); // 목록 새로고침
      } catch (error) {
        console.error("정산 승인 오류:", error);
        alert("처리 중 오류가 발생했습니다.");
      }
    },
    // ▼▼▼ [신규] 최종 지급액을 계산하는 메소드 추가 ▼▼▼
    calculateFinalPayout(req) {
      const companyFeeRate = 0.05;
      let finalCash = 0;
      let finalSaltmate = 0;

      // 1. 투자금 수익 계산
      if (req.roiBonus > 0) {
        const netRoi = req.roiBonus * (1 - companyFeeRate);
        finalCash += netRoi * 0.3;
        finalSaltmate += netRoi * 0.7;
      }

      // 2. 1대 매칭 보너스 계산
      if (req.matchingBonus > 0) {
        const netMatching = req.matchingBonus * (1 - companyFeeRate);
        finalSaltmate += netMatching; // 전액 SaltMate로 지급
      }

      return {
        cash: finalCash,
        saltmate: finalSaltmate,
      };
    },
  },
};
</script>

<style scoped>
/* 기존 스타일과 동일하되, 강조 표시를 위한 스타일 추가 */
.payout-manager h2 {
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
.payout-table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
  font-size: 0.95em;
}
.payout-table th,
.payout-table td {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
}
.payout-table thead th {
  background-color: #f8f9fa;
  font-weight: bold;
  color: #333;
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
  background-color: #28a745;
}
.final-amount {
  font-weight: bold;
}
.final-amount.cash {
  color: #007bff;
}
.final-amount.saltmate {
  color: #6f42c1;
}
</style>
