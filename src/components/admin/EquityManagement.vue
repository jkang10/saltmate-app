<template>
  <div class="management-page">
    <h3><i class="fas fa-chart-pie"></i> 지분 관리</h3>
    <p>회원들의 공장 지분율을 관리하고, 신규 지분을 부여합니다.</p>

    <div class="actions">
      <button @click="openGrantModal(null)" class="btn-primary">
        <i class="fas fa-plus"></i> 신규 지분 부여
      </button>
      <button @click="grantToNftHolders" class="btn-secondary">
        <i class="fas fa-users"></i> NFT 홀더 일괄 지급
      </button>
    </div>

    <div class="equity-list card">
      <h4>전체 지분 현황 (총 {{ totalEquity }}%)</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <table v-else-if="equityHolders.length > 0" class="data-table">
        <thead>
          <tr>
            <th>보유자 이름</th>
            <th>총 지분율 (%)</th>
            <th>세부 지분</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="holder in equityHolders" :key="holder.userId">
            <td>{{ holder.userName }}</td>
            <td>{{ holder.totalPercentage.toFixed(4) }} %</td>
            <td>
              <ul class="details-list">
                <li v-for="(perc, type) in holder.types" :key="type">
                  {{ type }}: {{ perc.toFixed(4) }}%
                </li>
              </ul>
            </td>
            <td class="actions-cell">
              <button
                @click="openGrantModal(holder)"
                class="btn btn-sm btn-primary"
              >
                지분 수정
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">
        <p>지분 정보를 가진 사용자가 없습니다.</p>
      </div>
    </div>

    <EquityGrantModal
      v-if="isModalVisible"
      :target-user="selectedUser"
      @close="isModalVisible = false"
      @equity-updated="fetchEquityData"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { db } from "@/firebaseConfig";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import EquityGrantModal from "./EquityGrantModal.vue";

const equityHolders = ref([]);
const loading = ref(true);
const isModalVisible = ref(false);
const selectedUser = ref(null);

const totalEquity = computed(() => {
  return equityHolders.value
    .reduce((sum, holder) => sum + (holder.totalPercentage || 0), 0)
    .toFixed(4);
});

const fetchEquityData = async () => {
  loading.value = true;
  try {
    const q = query(
      collection(db, "equity"),
      orderBy("totalPercentage", "desc"),
    );
    const querySnapshot = await getDocs(q);
    equityHolders.value = querySnapshot.docs.map((doc) => doc.data());
  } catch (error) {
    console.error("지분 데이터 로딩 실패:", error);
    alert("지분 데이터를 불러오는 데 실패했습니다.");
  } finally {
    loading.value = false;
  }
};

const grantToNftHolders = async () => {
  const equityType = prompt(
    "어떤 종류의 지분을 지급하시겠습니까? (예: 영암공장 2호기)",
  );
  if (!equityType) return;

  const percentageStr = prompt(
    `모든 NFT 보유자에게 몇 %의 '${equityType}' 지분을 지급하시겠습니까?`,
  );
  const percentage = parseFloat(percentageStr);
  if (isNaN(percentage) || percentage <= 0) {
    alert("유효한 지분율을 입력해주세요.");
    return;
  }

  if (
    !confirm(
      `정말로 모든 NFT 보유자에게 '${equityType}' 지분을 ${percentage}% 만큼 부여하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
    )
  )
    return;

  try {
    const functions = getFunctions();
    const updateUserEquity = httpsCallable(functions, "updateUserEquity");

    // Firestore에서 NFT를 보유한 모든 유저를 찾습니다.
    const nftQuery = query(collection(db, "nfts"));
    const nftSnapshot = await getDocs(nftQuery);
    const nftHolderIds = new Set(
      nftSnapshot.docs.map((doc) => doc.data().ownerId),
    );

    if (nftHolderIds.size === 0) {
      alert("지급할 NFT 보유자가 없습니다.");
      return;
    }

    const promises = [];
    nftHolderIds.forEach((userId) => {
      promises.push(
        updateUserEquity({
          userId: userId,
          equityType: equityType,
          newPercentage: percentage,
          reason: `NFT 보유자 일괄 지급 (${equityType})`,
        }),
      );
    });

    await Promise.all(promises);
    alert(
      `${nftHolderIds.size}명의 NFT 보유자에게 지분 지급이 완료되었습니다.`,
    );
    await fetchEquityData();
  } catch (error) {
    console.error("NFT 홀더 지분 일괄 지급 실패:", error);
    alert(`일괄 지급 중 오류가 발생했습니다: ${error.message}`);
  }
};

const openGrantModal = (holder) => {
  selectedUser.value = holder
    ? { userId: holder.userId, types: { ...holder.types } }
    : null;
  isModalVisible.value = true;
};

onMounted(fetchEquityData);
</script>

<style scoped>
.management-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3,
h4 {
  margin-top: 0;
}
.btn-primary {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}
.data-table th,
.data-table td {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
}
.data-table thead th {
  background-color: #f8f9fa;
}
.details-list {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
}
.loading-spinner,
.no-data {
  text-align: center;
  padding: 40px;
}
</style>
