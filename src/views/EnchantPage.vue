<template>
  <div class="page-container">
    <h1>강화소</h1>
    <p>아이템을 강화하여 특별한 효과를 얻으세요!</p>
    <div v-if="myItems.length > 0">
      <select v-model="selectedItemId">
        <option v-for="item in myItems" :key="item.id" :value="item.id">
          {{ item.itemName }} (+{{ item.level }})
        </option>
      </select>
      <button @click="enchant">강화하기</button>
    </div>
     <p v-if="resultMessage">{{ resultMessage }}</p>
  </div>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { db, functions, auth } from '@/firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const myItems = ref([]);
const selectedItemId = ref(null);
const resultMessage = ref('');
let unsubscribe = null;

onMounted(() => {
  if (auth.currentUser) {
    const itemsRef = collection(db, `users/${auth.currentUser.uid}/enchantItems`);
    unsubscribe = onSnapshot(itemsRef, (snapshot) => {
      myItems.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
  }
});

onUnmounted(() => { if(unsubscribe) unsubscribe(); });

const enchant = async () => {
  resultMessage.value = '';
  try {
    const attemptEnchant = httpsCallable(functions, 'attemptEnchant');
    const result = await attemptEnchant({ itemId: selectedItemId.value });
    resultMessage.value = result.data.message;
  } catch (e) {
    resultMessage.value = e.message;
  }
};
</script>