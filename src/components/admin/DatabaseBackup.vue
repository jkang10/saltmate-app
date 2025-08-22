<template>
  <div class="backup-manager">
    <h2><i class="fas fa-database"></i> 데이터베이스 백업</h2>
    <p>주요 컬렉션의 데이터를 JSON 파일로 다운로드합니다.</p>

    <div class="backup-grid">
      <div
        v-for="col in collectionsToBackup"
        :key="col.name"
        class="backup-card card"
      >
        <div class="card-icon" :class="col.color">
          <i :class="col.icon"></i>
        </div>
        <h3>{{ col.displayName }}</h3>
        <p>{{ col.description }}</p>
        <button
          @click="exportCollection(col.name, col.displayName)"
          :disabled="isExporting[col.name]"
        >
          <span v-if="isExporting[col.name]">내보내는 중...</span>
          <span v-else><i class="fas fa-file-download"></i> 다운로드</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { getFunctions, httpsCallable } from "firebase/functions";

// 백업할 컬렉션 목록 정의
const collectionsToBackup = [
  {
    name: "users",
    displayName: "회원 정보",
    description: "모든 회원의 프로필, 잔액 등 기본 정보입니다.",
    icon: "fas fa-users",
    color: "blue",
  },
  {
    name: "products",
    displayName: "상품 목록",
    description: "솔트메이트 몰에 등록된 모든 상품 정보입니다.",
    icon: "fas fa-box",
    color: "green",
  },
  {
    name: "orders",
    displayName: "주문 내역",
    description: "모든 회원의 상품 구매 기록입니다.",
    icon: "fas fa-truck",
    color: "orange",
  },
  {
    name: "transactions",
    displayName: "거래 내역",
    description: "모든 회원의 포인트 및 현금 거래 기록입니다.",
    icon: "fas fa-history",
    color: "purple",
  },
];

const isExporting = ref({});

const exportCollection = async (collectionName, displayName) => {
  if (!confirm(`'${displayName}' 데이터를 JSON 파일로 다운로드하시겠습니까?`))
    return;

  isExporting.value[collectionName] = true;
  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const exportCollectionToJson = httpsCallable(
      functions,
      "exportCollectionToJson",
    );
    const result = await exportCollectionToJson({
      collectionName: collectionName,
    });

    // 서버로부터 받은 JSON 데이터를 파일로 변환하여 다운로드
    const blob = new Blob([result.data.jsonData], {
      type: "application/json;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `${collectionName}-backup-${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error(`${displayName} 내보내기 실패:`, error);
    alert(
      `'${displayName}' 데이터 내보내기 중 오류가 발생했습니다: ${error.message}`,
    );
  } finally {
    isExporting.value[collectionName] = false;
  }
};
</script>

<style scoped>
.backup-manager {
  padding: 20px;
}
h2 {
  font-size: 1.8em;
  margin-bottom: 10px;
}
p {
  margin-bottom: 30px;
  color: #666;
}
.backup-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}
.backup-card {
  text-align: center;
  padding: 25px;
  border: 1px solid #eee;
  transition: all 0.3s ease;
}
.backup-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}
.card-icon {
  font-size: 2.5em;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto 15px;
  color: white;
}
.card-icon.blue {
  background-color: #007bff;
}
.card-icon.green {
  background-color: #28a745;
}
.card-icon.orange {
  background-color: #fd7e14;
}
.card-icon.purple {
  background-color: #6f42c1;
}
.backup-card h3 {
  margin-bottom: 10px;
}
.backup-card p {
  font-size: 0.9em;
  min-height: 40px;
}
.backup-card button {
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  border: none;
  background-color: #007bff;
  color: white;
  font-weight: bold;
  cursor: pointer;
}
.backup-card button:disabled {
  background-color: #a0c9ff;
}
</style>
