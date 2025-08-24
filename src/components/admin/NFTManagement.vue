// 파일 경로: src/components/admin/NFTManagement.vue

<template>
  <div class="management-container">
    <h3><i class="fas fa-gem"></i> NFT 관리</h3>
    <p>
      사용자의 NFT 보유 현황을 관리하고, 수동으로 종류를 선택하여 발행하거나
      회수합니다.
    </p>

    <div class="nft-form card">
      <h4>NFT 수동 발행</h4>
      <form @submit.prevent="issueNft">
        <div class="form-group">
          <label for="userSelect">대상 사용자 선택</label>
          <select id="userSelect" v-model="form.userId" required>
            <option disabled value="">NFT를 발행할 사용자를 선택하세요</option>
            <option v-for="user in allUsers" :key="user.id" :value="user.id">
              {{ user.name }} ({{ user.email }})
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="nftTypeSelect">NFT 종류 선택</label>
          <select id="nftTypeSelect" v-model="form.nftType" required>
            <option disabled value="">발행할 NFT 종류를 선택하세요</option>
            <option v-for="type in nftTypes" :key="type.id" :value="type.name">
              {{ type.name }}
            </option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary" :disabled="isProcessing">
          <span v-if="isProcessing">발행 중...</span>
          <span v-else>선택한 사용자에게 NFT 발행</span>
        </button>
      </form>
    </div>

    <div class="nft-holders-list card">
      <h4>NFT 보유자 목록</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <table v-else-if="nftHoldings.length > 0" class="holder-table">
        <thead>
          <tr>
            <th>보유자 이름</th>
            <th>NFT 종류</th>
            <th>총 지분율</th>
            <th>세부 지분 현황</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="holding in nftHoldings" :key="holding.nftId">
            <td>{{ holding.userName }} ({{ holding.userEmail }})</td>
            <td>
              <span class="nft-type-tag">{{ holding.nftType }}</span>
            </td>
            <td>{{ (holding.equity.totalPercentage || 0).toFixed(4) }} %</td>
            <td>
              <ul
                v-if="
                  holding.equity.types &&
                  Object.keys(holding.equity.types).length > 0
                "
                class="details-list"
              >
                <li v-for="(perc, type) in holding.equity.types" :key="type">
                  {{ type }}: {{ perc.toFixed(4) }}%
                </li>
              </ul>
              <span v-else class="no-equity">-</span>
            </td>
            <td>
              <button @click="revokeNft(holding)" class="btn btn-sm btn-danger">
                이 NFT 회수
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">NFT를 보유한 사용자가 없습니다.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  Timestamp,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

const allUsers = ref([]);
const nftTypes = ref([]);
const nftHoldings = ref([]);
const loading = ref(true);
const isProcessing = ref(false);

const form = reactive({
  userId: "",
  nftType: "",
});

const fetchData = async () => {
  loading.value = true;
  try {
    // 1. 모든 사용자 정보 가져오기
    const usersSnapshot = await getDocs(collection(db, "users"));
    allUsers.value = usersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 2. 모든 지분 정보 가져오기
    const equitySnapshot = await getDocs(collection(db, "equity"));
    const equityMap = new Map(
      equitySnapshot.docs.map((doc) => [doc.id, doc.data()]),
    );

    // 3. 모든 사용자를 순회하며 각 사용자의 NFT 정보 가져오기
    const holdings = [];
    for (const user of allUsers.value) {
      const userNftsSnapshot = await getDocs(
        collection(db, `users/${user.id}/nfts`),
      );
      if (!userNftsSnapshot.empty) {
        userNftsSnapshot.docs.forEach((nftDoc) => {
          holdings.push({
            nftId: nftDoc.id,
            nftType: nftDoc.data().type,
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            equity: equityMap.get(user.id) || { totalPercentage: 0, types: {} },
          });
        });
      }
    }
    nftHoldings.value = holdings;
  } catch (error) {
    console.error("데이터를 불러오는 중 오류 발생:", error);
  } finally {
    loading.value = false;
  }
};

const fetchNftTypes = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "nftTypes"));
    nftTypes.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("NFT 종류 목록을 불러오는 중 오류 발생:", error);
  }
};

const issueNft = async () => {
  if (!form.userId || !form.nftType) {
    alert("사용자와 NFT 종류를 모두 선택해주세요.");
    return;
  }
  const user = allUsers.value.find((u) => u.id === form.userId);
  if (
    !confirm(`'${user.name}'님에게 '${form.nftType}' NFT를 발행하시겠습니까?`)
  )
    return;

  isProcessing.value = true;
  try {
    // [수정] 최상위 'nfts' 컬렉션에 문서를 추가합니다.
    const nftTypeData =
      nftTypes.value.find((t) => t.name === form.nftType) || {};

    await addDoc(collection(db, "nfts"), {
      ownerId: form.userId, // [핵심] 소유자의 UID를 저장합니다.
      ownerName: user.name,
      type: form.nftType,
      tier: nftTypeData.tier || "N/A", // NFT 종류에서 등급 정보 가져오기
      name: nftTypeData.name || form.nftType,
      description: nftTypeData.description || "설명이 없습니다.",
      imageUrl: nftTypeData.imageUrl || "https://via.placeholder.com/400x500",
      mintDate: Timestamp.now(),
    });

    alert("NFT가 성공적으로 발행되었습니다.");
    form.userId = "";
    form.nftType = "";
    await fetchData(); // 목록을 새로고침합니다.
  } catch (error) {
    console.error("NFT 발행 중 오류 발생:", error);
    alert("NFT 발행 중 오류가 발생했습니다.");
  } finally {
    isProcessing.value = false;
  }
};

const revokeNft = async (holding) => {
  if (
    !confirm(
      `'${holding.userName}'님의 '${holding.nftType}' NFT를 회수하시겠습니까?`,
    )
  )
    return;

  isProcessing.value = true;
  try {
    // 지정된 NFT 문서만 삭제
    const nftDocRef = doc(db, `users/${holding.userId}/nfts`, holding.nftId);
    await deleteDoc(nftDocRef);

    alert("NFT가 성공적으로 회수되었습니다.");
    await fetchData();
  } catch (error) {
    console.error("NFT 회수 중 오류 발생:", error);
    alert("NFT 회수 중 오류가 발생했습니다.");
  } finally {
    isProcessing.value = false;
  }
};

onMounted(async () => {
  await fetchNftTypes();
  await fetchData();
});
</script>

<style scoped>
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
.nft-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-group label {
  font-weight: 600;
}
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
}
.holder-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.holder-table th,
.holder-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
  vertical-align: middle;
}
.holder-table th {
  background-color: #f8f9fa;
}
.details-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.no-equity {
  color: #999;
}
.nft-type-tag {
  background-color: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.9em;
  font-weight: bold;
}
.btn,
.btn-primary,
.btn-danger,
.btn-sm {
  padding: 8px 12px;
  border-radius: 5px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.9em;
}
</style>
