// 파일 경로: src/components/admin/EquityManagement.vue

<template>
  <div class="management-page">
    <h3><i class="fas fa-chart-pie"></i> 지분 관리</h3>
    <p>회원들의 공장 지분율을 관리하고, 신규 지분을 부여합니다.</p>

    <div class="equity-types-management card">
      <h4>지분 항목 관리</h4>
      <div class="type-list">
        <span
          v-for="type in equityTypes"
          :key="type.id"
          class="equity-type-tag"
        >
          {{ type.name }}
          <button
            @click="deleteEquityType(type.id, type.name)"
            class="btn-delete"
          >
            &times;
          </button>
        </span>
      </div>
      <form @submit.prevent="addEquityType" class="add-type-form">
        <input
          type="text"
          v-model="newEquityTypeName"
          placeholder="새 지분 항목 이름 (예: 제주공장)"
          required
        />
        <button type="submit" class="btn-primary btn-sm">항목 추가</button>
      </form>
    </div>
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
// ▼▼▼ [수정됨] Firestore 관련 함수 추가 ▼▼▼
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import EquityGrantModal from "./EquityGrantModal.vue";

const equityHolders = ref([]);
const loading = ref(true);
const isModalVisible = ref(false);
const selectedUser = ref(null);
// ▼▼▼ [추가됨] 지분 종류 관련 ref ▼▼▼
const equityTypes = ref([]);
const newEquityTypeName = ref("");
// ▲▲▲ 추가 완료 ▲▲▲

const totalEquity = computed(() => {
  return equityHolders.value
    .reduce((sum, holder) => sum + (holder.totalPercentage || 0), 0)
    .toFixed(4);
});

// ▼▼▼ [추가됨] 지분 종류 데이터 로딩 함수 ▼▼▼
const fetchEquityTypes = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "equityTypes"));
    equityTypes.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("지분 종류 로딩 실패:", error);
  }
};
// ▲▲▲ 추가 완료 ▲▲▲

// ▼▼▼ [추가됨] 지분 종류 추가 함수 ▼▼▼
const addEquityType = async () => {
  if (!newEquityTypeName.value.trim()) return;
  const newName = newEquityTypeName.value.trim();
  const docId = newName.replace(/\s+/g, "_"); // 문서 ID로 사용할 수 있도록 공백 제거

  try {
    await setDoc(doc(db, "equityTypes", docId), { name: newName });
    alert(`'${newName}' 항목이 추가되었습니다.`);
    newEquityTypeName.value = "";
    await fetchEquityTypes();
  } catch (error) {
    console.error("지분 종류 추가 실패:", error);
    alert("항목 추가에 실패했습니다.");
  }
};
// ▲▲▲ 추가 완료 ▲▲▲

// ▼▼▼ [추가됨] 지분 종류 삭제 함수 ▼▼▼
const deleteEquityType = async (typeId, typeName) => {
  if (!confirm(`정말로 '${typeName}' 항목을 삭제하시겠습니까?`)) return;

  try {
    await deleteDoc(doc(db, "equityTypes", typeId));
    alert(`'${typeName}' 항목이 삭제되었습니다.`);
    await fetchEquityTypes();
  } catch (error) {
    console.error("지분 종류 삭제 실패:", error);
    alert("항목 삭제에 실패했습니다.");
  }
};
// ▲▲▲ 추가 완료 ▲▲▲

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

onMounted(() => {
  fetchEquityData();
  fetchEquityTypes(); // [추가됨] 페이지 로드 시 지분 종류도 불러오기
});
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
.btn-sm {
  padding: 5px 10px;
  font-size: 0.9em;
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

/* ▼▼▼ [추가됨] 지분 종류 관리 스타일 ▼▼▼ */
.equity-types-management {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.type-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.equity-type-tag {
  background-color: #e9ecef;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 5px;
}
.btn-delete {
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  line-height: 1;
}
.add-type-form {
  display: flex;
  gap: 10px;
}
.add-type-form input {
  flex-grow: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
/* ▲▲▲ 추가 완료 ▲▲▲ */
</style>
