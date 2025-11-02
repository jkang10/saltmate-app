<template>
  <div class="my-orders-page">
    
    <header class="mall-header-banner">
      <div class="banner-content">
        <h1><i class="fas fa-box-open"></i> 나의 주문 내역</h1>
        <p class="description">
          솔트메이트 몰에서의 주문 및 배송 현황을 확인합니다.
        </p>
        <nav class="sub-nav">
          <router-link to="/mall" class="sub-nav-item">상품 목록</router-link>
          <router-link to="/my-orders" class="sub-nav-item router-link-exact-active">나의 주문 내역</router-link>
        </nav>
      </div>
    </header>

    <main class="content-wrapper">
      <div class="card">
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
        </div>
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
        </div>
        <div v-else-if="orders.length === 0" class="empty-state">
          <p>주문 내역이 없습니다.</p>
          <router-link to="/mall" class="btn-primary">쇼핑하러 가기</router-link>
        </div>
        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>주문일시</th>
                <th>주문 상품</th>
                <th>결제 금액</th>
                <th>배송 상태</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.id">
                <td data-label="주문일시">{{ formatDate(order.createdAt) }}</td>
                <td data-label="주문 상품">{{ getOrderItemsText(order.orderItems) }}</td>
                <td data-label="결제 금액">{{ (order.totalPrice || 0).toLocaleString() }} P</td>
                <td data-label="배송 상태">
                  <span :class="['status-badge', order.status]">{{
                    formatStatus(order.status)
                  }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script>
// (script 내용은 이전과 100% 동일합니다)
import { auth, db } from "@/firebaseConfig";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

export default {
  name: "MyOrdersPage",
  data() {
    return {
      orders: [],
      isLoading: true,
      error: null,
    };
  },
  async created() {
    await this.fetchMyOrders();
  },
  methods: {
    async fetchMyOrders() {
      this.isLoading = true;
      if (!auth.currentUser) {
        this.error = "로그인이 필요합니다.";
        this.isLoading = false;
        return;
      }
      try {
        const q = query(
          collection(db, "orders"),
          where("userId", "==", auth.currentUser.uid),
          orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        this.orders = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error("주문 내역 조회 오류:", error);
        this.error = "주문 내역을 불러오는 데 실패했습니다.";
      } finally {
        this.isLoading = false;
      }
    },
    formatDate(timestamp) {
      return timestamp?.toDate().toLocaleString("ko-KR") || "";
    },
    formatStatus(status) {
      const map = {
        pending: "결제대기",
        paid: "배송준비",
        shipped: "배송완료",
        cancelled: "주문취소",
      };
      return map[status] || status;
    },
    getOrderItemsText(items) {
      if (!items || items.length === 0) return "상품 정보 없음";
      const firstItem = items[0];
      let text = `${firstItem.productName} ${firstItem.quantity}개`;
      if (items.length > 1) {
        text += ` 외 ${items.length - 1}건`;
      }
      return text;
    },
  },
};
</script>

<style scoped>
/* ▼▼▼ [핵심 수정] MallPage.vue와 동일한 새 디자인 CSS ▼▼▼ */

.my-orders-page {
  width: 100%;
  min-height: 100vh;
  background-color: #f8f9fa; /* 밝은 배경색 */
}

/* 1. 상단 배너 및 탭 */
.mall-header-banner {
  width: 100%;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #4a0e97 0%, #2c3e50 100%); /* 솔레인 보라색 -> 어두운 파랑 */
  color: white;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  margin-bottom: 2rem; /* App.vue의 70px 마진을 고려하여 margin-top 제거 */
}
.banner-content {
  max-width: 1200px;
  margin: 0 auto;
}
.banner-content h1 {
  font-size: 2.8em;
  font-weight: 700;
  margin: 0 0 10px 0;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.banner-content .description {
  font-size: 1.2em;
  color: #bdc3c7;
  margin-bottom: 2rem;
}
.sub-nav {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin: 0;
  padding: 0;
  border-bottom: none;
}
.sub-nav-item {
  text-decoration: none;
  color: #ecf0f1;
  font-weight: bold;
  padding: 10px 20px;
  border-radius: 50px; /* 알약 모양 */
  border: 2px solid transparent;
  transition: all 0.3s ease;
}
.sub-nav-item.router-link-exact-active,
.sub-nav-item:hover {
  background-color: rgba(255, 255, 255, 0.9);
  color: #4a0e97; /* 보라색 텍스트 */
  border-color: transparent;
}
.sub-nav-item:not(.router-link-exact-active):hover {
   background-color: rgba(255, 255, 255, 0.1);
   color: #fff;
}

/* 2. 콘텐츠 래퍼 */
.content-wrapper {
  max-width: 1200px; /* 콘텐츠 최대 너비 */
  margin: 0 auto;
  padding: 0 2rem 3rem 2rem; /* 좌우 패딩 */
}
.card {
  background: #fff;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  border-radius: 15px;
  padding: 30px;
}

/* 3. 로딩/에러/빈 상태 */
.loading-state,
.empty-state,
.error-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
.empty-state p {
  margin-bottom: 20px;
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
  to { transform: rotate(360deg); }
}

/* 4. 테이블 디자인 */
.table-container {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  text-align: left; /* [★수정★] 왼쪽 정렬 */
  min-width: 600px; /* 모바일에서 가로 스크롤 생성 */
}
th,
td {
  padding: 15px; /* [★수정★] 패딩 증가 */
  border-bottom: 1px solid #eee;
}
thead th {
  background-color: #f8f9fa;
  font-weight: 600; /* [★수정★] 폰트 두께 */
  color: #333;
  font-size: 0.9em;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
tbody tr:hover {
  background-color: #f8f9fa; /* 호버 효과 */
}
td[data-label="결제 금액"] {
  font-weight: bold;
  color: #4a0e97; /* [★수정★] 보라색 */
  font-size: 1.1em;
}

/* 5. 배송 상태 뱃지 */
.status-badge {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.85em;
  font-weight: bold;
  color: #fff;
}
.status-badge.pending {
  background-color: #ffc107;
  color: #333;
}
.status-badge.paid {
  background-color: #007bff;
}
.status-badge.shipped {
  background-color: #28a745;
}
.status-badge.cancelled {
  background-color: #6c757d;
}

/* 6. 버튼 */
.btn-primary {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  transition: background-color 0.2s ease;
}
.btn-primary:hover {
  background-color: #0056b3;
}

/* 7. 모바일 반응형 (테이블) */
@media (max-width: 768px) {
  .sub-nav {
    flex-direction: column;
    align-items: center;
  }
  .content-wrapper {
    padding: 0 1rem 2rem 1rem;
  }
  .card {
    padding: 15px;
  }
  
  /* [★신규★] 모바일용 반응형 테이블 */
  table {
    min-width: 0;
  }
  table thead {
    display: none; /* 테이블 헤더 숨김 */
  }
  table tbody, table tr, table td {
    display: block;
    width: 100%;
  }
  table tr {
    border: 1px solid #eee;
    border-radius: 8px;
    margin-bottom: 15px;
    padding: 10px;
  }
  table td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 5px;
    border-bottom: 1px dotted #eee;
  }
  table td:last-child {
    border-bottom: none;
  }
  table td::before {
    content: attr(data-label); /* data-label 속성값 가져오기 */
    font-weight: 600;
    color: #555;
    padding-right: 15px;
  }
}
</style>