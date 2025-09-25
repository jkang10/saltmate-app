<template>
  <div class="page-container enchant-page">
    <header class="page-header">
      <h1><i class="fas fa-magic"></i> 강화소</h1>
      <p>미네랄 결정을 강화하여 특별한 보상을 노려보세요!</p>
    </header>

    <div class="card enchant-card">
      <div class="item-display">
        <div class="item-icon" :class="animationClass">💎</div>
        <div class="item-level" v-if="myItem">+{{ myItem?.level || 0 }}</div>
      </div>

      <div v-if="myItem" class="enchant-info">
        <p>다음 강화 비용: <strong>{{ (100 * ((myItem.level || 0) + 1)).toLocaleString() }} SaltMate</strong></p>
        <p>성공 확률: <strong>{{ Math.max(10, 95 - ((myItem.level || 0) * 5)) }}%</strong></p>
        <p v-if="(myItem.level || 0) >= 5" class="destroy-warning">
            <i class="fas fa-exclamation-triangle"></i> 실패 시 10% 확률로 아이템이 파괴됩니다!
        </p>
      </div>
      <div v-else class="no-item">
          <p>강화할 아이템이 없습니다.</p>
          <button @click="createInitialItem" class="btn-primary">기본 결정 받기</button>
      </div>

      <button v-if="myItem" @click="enchant" :disabled="isEnchanting" class="btn-primary btn-enchant">
        <span v-if="isEnchanting" class="spinner-small"></span>
        <span v-else>강화하기</span>
      </button>
      <p v-if="resultMessage" class="result-message" :class="resultStatus">{{ resultMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { db, functions, auth } from '@/firebaseConfig';
// [수정] 사용하지 않는 doc, setDoc을 제거하고 addDoc을 추가합니다.
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

// [수정] 사용하지 않는 myItems 변수를 제거합니다.
const myItem = ref(null); // 한 개의 아이템만 관리
const isEnchanting = ref(false);
const resultMessage = ref('');
const resultStatus = ref('');
const animationClass = ref('');
let unsubscribe = null;

const createInitialItem = async () => {
    if (!auth.currentUser) return;
    try {
        const itemsRef = collection(db, `users/${auth.currentUser.uid}/enchantItems`);
        // [수정] setDoc 대신 addDoc을 사용하여 새 문서를 생성합니다.
        await addDoc(itemsRef, {
            itemName: "미네랄 결정",
            level: 0,
            createdAt: new Date(),
        });
        alert('기본 미네랄 결정을 획득했습니다!');
    } catch(e) {
        console.error("아이템 생성 오류:", e);
    }
};

onMounted(() => {
  if (auth.currentUser) {
    const itemsRef = collection(db, `users/${auth.currentUser.uid}/enchantItems`);
    unsubscribe = onSnapshot(itemsRef, (snapshot) => {
      if(!snapshot.empty) {
          const doc = snapshot.docs[0]; // 이 게임에서는 아이템 1개만 사용
          myItem.value = { id: doc.id, ...doc.data() };
      } else {
          myItem.value = null;
      }
    });
  }
});

onUnmounted(() => { if(unsubscribe) unsubscribe(); });

const enchant = async () => {
  if (!myItem.value) return;
  isEnchanting.value = true;
  resultMessage.value = '';
  animationClass.value = 'enchanting';
  
  try {
    const attemptEnchant = httpsCallable(functions, 'attemptEnchant');
    const result = await attemptEnchant({ itemId: myItem.value.id });
    
    setTimeout(() => {
      animationClass.value = result.data.success ? 'success' : 'failure';
      resultMessage.value = result.data.message;
      resultStatus.value = result.data.success ? 'success' : 'failure';
    }, 1500); // 애니메이션 시간
    
  } catch (e) {
    animationClass.value = 'failure';
    resultMessage.value = e.message;
    resultStatus.value = 'failure';
  } finally {
    setTimeout(() => {
        isEnchanting.value = false;
        animationClass.value = '';
    }, 2500);
  }
};
</script>

<style scoped>
.page-container { max-width: 600px; margin: 90px auto 20px; padding: 20px; }
.page-header { text-align: center; margin-bottom: 20px; }
.enchant-page { text-align: center; }
.card { background: white; border-radius: 16px; padding: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); }
.enchant-card { max-width: 400px; margin: 0 auto; }
.item-display { font-size: 6em; margin: 20px 0; position: relative; display: inline-block; }
.item-level { position: absolute; bottom: -10px; right: -10px; font-size: 0.4em; font-weight: bold; background: #333; color: white; padding: 5px 10px; border-radius: 10px; border: 2px solid white; }
.destroy-warning { color: #dc3545; font-weight: bold; font-size: 0.9em; }
.result-message { font-weight: bold; font-size: 1.2em; margin-top: 15px; }
.result-message.success { color: #28a745; }
.result-message.failure { color: #dc3545; }
.btn-enchant { width: 100%; padding: 12px; font-size: 1.2em; }
.no-item { margin: 30px 0; }
.btn-primary { padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
.spinner-small { border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }

/* 애니메이션 */
.enchanting { animation: enchanting-anim 1.5s ease-in-out; }
@keyframes enchanting-anim { 
    0% { transform: scale(1); filter: brightness(1); }
    10% { transform: scale(1.05) translateX(-5px); }
    20% { transform: scale(1.05) translateX(5px); }
    30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); filter: brightness(1.5); }
    40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); filter: brightness(1.5); }
    100% { transform: scale(1.2); filter: brightness(2) drop-shadow(0 0 15px white); }
}
.success { animation: success-anim 0.5s ease-out forwards; }
@keyframes success-anim { 
    0% { transform: scale(1.2); filter: brightness(2) drop-shadow(0 0 15px #ffd700); }
    100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 20px #28a745); }
}
.failure { animation: failure-anim 0.5s ease-in forwards; }
@keyframes failure-anim {
    0% { transform: translateX(0); }
    25% { transform: translateX(-5px) rotate(-5deg); }
    50% { transform: translateX(5px) rotate(5deg); }
    75% { transform: translateX(-2px) rotate(-2deg); }
    100% { transform: translateX(0); opacity: 0.7; filter: grayscale(1); }
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>