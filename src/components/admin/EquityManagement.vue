<template>
  <div class="management-container">
    <h3><i class="fas fa-chart-pie"></i> 지분 관리</h3>
    <p>NFT 보유자들의 공장 지분율을 관리합니다.</p>

    <div class="equity-list card">
      <h4>전체 지분 현황 (총 {{ totalEquity }}%)</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <table v-else-if="equityHolders.length > 0" class="equity-table">
        <thead>
          <tr>
            <th>보유자 이름</th>
            <th>이메일</th>
            <th>현재 지분율 (%)</th>
            <th>새 지분율 입력</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="holder in equityHolders" :key="holder.userId">
            <td>{{ holder.userName }}</td>
            <td>{{ holder.userEmail }}</td>
            <td>{{ holder.equityPercentage }} %</td>
            <td>
              <input
                type="number"
                v-model.number="holder.newEquity"
                min="0"
                max="100"
                step="0.01"
                placeholder="새 지분율"
                class="equity-input"
              />
            </td>
            <td>
              <button
                @click="updateEquity(holder)"
                class="btn btn-sm btn-primary"
              >
                지분율 저장
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">지분 정보를 가진 사용자가 없습니다.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { db } from "@/firebaseConfig";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";

const equityHolders = ref([]);
const loading = ref(true);

const totalEquity = computed(() => {
  return equityHolders.value
    .reduce((sum, holder) => sum + (holder.equityPercentage || 0), 0)
    .toFixed(2);
});

const fetchEquityData = async () => {
  loading.value = true;
  try {
    const querySnapshot = await getDocs(collection(db, "equity"));
    equityHolders.value = querySnapshot.docs.map((doc) => ({
      ...doc.data(),
      newEquity: null, // 수정을 위한 입력 필드 초기화
    }));
  } catch (error) {
    console.error("지분 정보를 불러오는 중 오류 발생:", error);
  } finally {
    loading.value = false;
  }
};

const updateEquity = async (holder) => {
  if (holder.newEquity === null || holder.newEquity < 0) {
    alert("유효한 지분율을 입력해주세요.");
    return;
  }
  if (
    !confirm(
      `'${holder.userName}'님의 지분율을 ${holder.newEquity}%로 변경하시겠습니까?`,
    )
  )
    return;

  const equityRef = doc(db, "equity", holder.userId);
  try {
    await updateDoc(equityRef, {
      equityPercentage: holder.newEquity,
    });
    alert("지분율이 성공적으로 업데이트되었습니다.");
    await fetchEquityData(); // 목록 새로고침
  } catch (error) {
    console.error("지분율 업데이트 중 오류 발생:", error);
  }
};

onMounted(fetchEquityData);
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

.equity-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.equity-table th,
.equity-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
  vertical-align: middle;
}
.equity-input {
  width: 100px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 5px;
}
/* ... (버튼, 로딩 스피너 등 공용 스타일) ... */
</style>
