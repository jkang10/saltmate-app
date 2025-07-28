<template>
  <div class="management-container">
    <h3><i class="fas fa-gem"></i> NFT 관리</h3>
    <p>사용자의 공장 지분 연동 NFT 보유 현황을 관리하고, 수동으로 발행하거나 회수합니다.</p>

    <div class="nft-form card">
      <h4>NFT 수동 발행</h4>
      <form @submit.prevent="issueNft">
        <div class="form-group">
          <label for="userSelect">대상 사용자 선택</label>
          <select id="userSelect" v-model="selectedUserId" required>
            <option disabled value="">NFT를 발행할 사용자를 선택하세요</option>
            <option v-for="user in usersWithoutNft" :key="user.id" :value="user.id">
              {{ user.name }} ({{ user.email }})
            </option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary">선택한 사용자에게 NFT 발행</button>
      </form>
    </div>

    <div class="nft-holders-list card">
      <h4>NFT 보유자 목록</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <table v-else-if="nftHolders.length > 0" class="holder-table">
        <thead>
          <tr>
            <th>보유자 이름</th>
            <th>이메일</th>
            <th>지분율</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="holder in nftHolders" :key="holder.id">
            <td>{{ holder.name }}</td>
            <td>{{ holder.email }}</td>
            <td>{{ holder.equityPercentage || 0 }} %</td>
            <td>
              <button @click="revokeNft(holder)" class="btn btn-sm btn-danger">
                NFT 회수
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
import { ref, onMounted, computed } from 'vue';
import { db } from '@/firebaseConfig';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';

const allUsers = ref([]);
const loading = ref(true);
const selectedUserId = ref('');

const nftHolders = computed(() => allUsers.value.filter(u => u.hasNFT));
const usersWithoutNft = computed(() => allUsers.value.filter(u => !u.hasNFT));

const fetchUsers = async () => {
  loading.value = true;
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    allUsers.value = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("사용자 목록을 불러오는 중 오류 발생:", error);
  } finally {
    loading.value = false;
  }
};

const issueNft = async () => {
  if (!selectedUserId.value) {
    alert('NFT를 발행할 사용자를 선택해주세요.');
    return;
  }
  const user = allUsers.value.find(u => u.id === selectedUserId.value);
  if (!confirm(`'${user.name}'님에게 NFT를 발행하시겠습니까?`)) return;

  const batch = writeBatch(db);
  const userRef = doc(db, 'users', selectedUserId.value);
  const equityRef = doc(db, 'equity', selectedUserId.value); // 지분 문서도 함께 생성

  // 1. 사용자 문서 업데이트 (hasNFT: true)
  batch.update(userRef, { hasNFT: true });
  // 2. 지분 문서 생성 (기본값 0%)
  batch.set(equityRef, {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    equityPercentage: 0,
  });

  try {
    await batch.commit();
    alert('NFT가 성공적으로 발행되었습니다.');
    selectedUserId.value = '';
    await fetchUsers();
  } catch (error) {
    console.error("NFT 발행 중 오류 발생:", error);
  }
};

const revokeNft = async (user) => {
  if (!confirm(`'${user.name}'님의 NFT를 회수하시겠습니까? 이 작업은 해당 사용자의 지분 정보도 함께 삭제합니다.`)) return;
  
  const batch = writeBatch(db);
  const userRef = doc(db, 'users', user.id);
  const equityRef = doc(db, 'equity', user.id);

  // 1. 사용자 문서 업데이트 (hasNFT: false)
  batch.update(userRef, { hasNFT: false });
  // 2. 지분 문서 삭제
  batch.delete(equityRef);

  try {
    await batch.commit();
    alert('NFT가 성공적으로 회수되었습니다.');
    await fetchUsers();
  } catch (error) {
    console.error("NFT 회수 중 오류 발생:", error);
  }
};

onMounted(fetchUsers);
</script>

<style scoped>
/* 이전 컴포넌트들과 유사한 스타일 */
.management-container { display: flex; flex-direction: column; gap: 30px; }
.card { background-color: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
h3, h4 { margin-top: 0; }
.nft-form .form-group { margin-bottom: 20px; }
.nft-form label { display: block; margin-bottom: 8px; font-weight: 600; }
.nft-form select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
.holder-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
.holder-table th, .holder-table td { border-bottom: 1px solid #eee; padding: 12px 15px; text-align: left; }
/* ... (버튼, 로딩 스피너 등 공용 스타일) ... */
</style>