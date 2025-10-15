<template>
  <div class="salt-arena-page">
    <header class="page-header">
      <h1><i class="fas fa-chess-rook"></i> 솔트 아레나</h1>
      <p>나만의 덱으로 상대방의 타워를 파괴하고 승리하세요!</p>
    </header>

    <div v-if="!matchId" class="lobby-container card">
      <h2>아레나 로비</h2>
      <div v-if="arenaData.decks" class="deck-selection">
        <h4><i class="fas fa-clone"></i> 나의 덱</h4>
        <div class="deck-info">
          <strong>{{ arenaData.decks[arenaData.activeDeckIndex]?.name }}</strong>
          <div class="deck-cards">
            <span v-for="cardId in arenaData.decks[arenaData.activeDeckIndex]?.cards" :key="cardId" class="card-tag">
              {{ allCards[cardId]?.name || '카드' }}
            </span>
          </div>
        </div>
      </div>
      <button @click="startMatchmaking" class="match-button" :disabled="isMatching">
        <span v-if="isMatching" class="spinner-small"></span>
        <span v-else>대전 찾기</span>
      </button>
    </div>

    <div v-if="matchId && gameState.players">
      <main class="arena-container">
        <div class="player-area opponent">
          <div class="player-info">
            <span>{{ opponent.name }}</span>
            <div class="tower main-tower">HP: {{ opponent.mainTowerHp }}</div>
          </div>
          <div class="tower side-tower">HP: {{ opponent.sideTower1Hp }}</div>
          <div class="tower side-tower">HP: {{ opponent.sideTower2Hp }}</div>
        </div>

        <div class="game-field" @click="onFieldClick">
          <transition-group name="unit-fade">
            <div v-for="unit in gameState.units" :key="unit.id" class="unit" 
                 :class="{ mine: unit.owner === auth.currentUser.uid }"
                 :style="{ left: `${unit.x}%`, top: `${unit.y}%` }">
              {{ unit.name }}
            </div>
          </transition-group>
        </div>

        <div class="player-area self">
          <div class="tower side-tower">HP: {{ self.sideTower1Hp }}</div>
          <div class="tower side-tower">HP: {{ self.sideTower2Hp }}</div>
          <div class="player-info">
            <div class="tower main-tower">HP: {{ self.mainTowerHp }}</div>
            <span>{{ self.name }}</span>
          </div>
        </div>
      </main>

      <footer class="game-footer">
        <div class="energy-bar">
          <div class="energy-fill" :style="{ width: `${(self.energy || 0) * 10}%` }"></div>
          <span class="energy-text">{{ self.energy || 0 }} / 10</span>
        </div>
        <div class="card-deck">
          <div v-for="(cardId, index) in gameState.hands?.[auth.currentUser.uid]" :key="index" 
               class="card-in-hand" 
               :class="{ selected: selectedCardId === cardId, affordable: self.energy >= (allCards[cardId]?.cost || 99) }"
               @click="selectCard(cardId)">
            <div class="card-cost">{{ allCards[cardId]?.cost }}</div>
            <div class="card-name">{{ allCards[cardId]?.name }}</div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { httpsCallable } from "firebase/functions";
import { functions, db, auth } from "@/firebaseConfig";
import { doc, onSnapshot, collection, getDocs } from "firebase/firestore";

const isMatching = ref(false);
const matchId = ref(null);
const gameState = reactive({});
let unsubscribe = null;

const arenaData = reactive({ decks: [], activeDeckIndex: 0, hands: {}, deck: {} });
const allCards = reactive({});
const selectedCardId = ref(null);

const selfId = computed(() => auth.currentUser?.uid);
const self = computed(() => gameState.players?.[selfId.value] || {});
const opponent = computed(() => {
  const opponentId = Object.keys(gameState.players || {}).find(id => id !== selfId.value);
  return gameState.players?.[opponentId] || {};
});

const startMatchmaking = async () => {
  isMatching.value = true;
  try {
    const startArenaMatch = httpsCallable(functions, 'startArenaMatch');
    const result = await startArenaMatch();
    if (result.data.success) {
      matchId.value = result.data.matchId;
      listenToGame();
    }
  } catch (error) {
    alert(`매칭 실패: ${error.message}`);
  } finally {
    isMatching.value = false;
  }
};

const listenToGame = () => {
  if (!matchId.value) return;
  const matchRef = doc(db, "arenaMatches", matchId.value);
  unsubscribe = onSnapshot(matchRef, (docSnap) => {
    if (docSnap.exists()) {
      Object.assign(gameState, docSnap.data());
    }
  });
};

const selectCard = (cardId) => {
  if (self.value.energy >= (allCards[cardId]?.cost || 99)) {
    selectedCardId.value = selectedCardId.value === cardId ? null : cardId;
  }
};

const onFieldClick = async (event) => {
  if (selectedCardId.value === null) return;
  
  const field = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - field.left) / field.width) * 100;
  const y = ((event.clientY - field.top) / field.height) * 100;

  if (y < 50) {
    alert("자신의 진영(아래쪽 절반)에만 유닛을 소환할 수 있습니다.");
    return;
  }
  
  try {
    const playArenaCard = httpsCallable(functions, 'playArenaCard');
    await playArenaCard({ matchId: matchId.value, cardId: selectedCardId.value, position: { x, y } });
    selectedCardId.value = null;
  } catch (error) {
    alert(`카드 사용 실패: ${error.message}`);
  }
};

onMounted(async () => {
  try {
    const cardsSnap = await getDocs(collection(db, "allCards"));
    cardsSnap.forEach(doc => { allCards[doc.id] = doc.data(); });

    const getArenaData = httpsCallable(functions, 'getArenaData');
    const result = await getArenaData();
    Object.assign(arenaData, result.data);
  } catch (e) {
    console.error("데이터 로딩 실패:", e);
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.salt-arena-page { max-width: 500px; margin: 70px auto 20px; background: #34495e; color: #fff; border-radius: 15px; padding: 20px; font-family: sans-serif; }
.page-header { text-align: center; margin-bottom: 20px; }
.arena-container { display: flex; flex-direction: column; background-color: #2c3e50; border-radius: 10px; padding: 10px; }
.player-area { display: flex; justify-content: space-between; align-items: center; }
.player-info { text-align: center; }
.tower { width: 60px; height: 80px; border: 2px solid #7f8c8d; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; }
.main-tower { height: 100px; }
.opponent .tower { background: #e74c3c; }
.self .tower { background: #3498db; }
.game-field { height: 400px; background: #27ae60; margin: 10px 0; border-radius: 5px; position: relative; cursor: crosshair; }
.game-footer { margin-top: 20px; }
.energy-bar { background-color: #2c3e50; border-radius: 5px; padding: 3px; margin-bottom: 10px; position: relative; }
.energy-fill { height: 20px; background: linear-gradient(90deg, #8e44ad, #9b59b6); border-radius: 3px; transition: width 0.5s linear; }
.energy-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-weight: bold; }
.card-deck { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.card-in-hand { height: 120px; background: #ecf0f1; color: #2c3e50; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: bold; border: 2px solid #bdc3c7; position: relative; cursor: pointer; }
.card-cost { position: absolute; top: 5px; left: 5px; background: #8e44ad; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.lobby-container { text-align: center; padding: 30px; }
.deck-selection { margin-bottom: 20px; }
.deck-info { background: #eee; padding: 10px; border-radius: 8px; color: #333; }
.card-tag { background: #ccc; padding: 3px 8px; border-radius: 5px; margin: 2px; display: inline-block; font-size: 0.9em; }
.match-button { padding: 15px 40px; font-size: 1.2em; font-weight: bold; border: none; border-radius: 10px; background: #28a745; color: white; cursor: pointer; }
.spinner-small { border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: #fff; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
.unit { position: absolute; transform: translate(-50%, -50%); background: #fff; color: #000; padding: 8px 12px; border-radius: 20px; font-weight: bold; font-size: 0.9em; border: 2px solid #2c3e50; transition: top 1s linear, left 1s linear; }
.unit.mine { background: #3498db; color: #fff; border-color: #ecf0f1; }
.unit-fade-enter-active, .unit-fade-leave-active { transition: opacity 0.5s ease; }
.unit-fade-enter-from, .unit-fade-leave-to { opacity: 0; }
.card-in-hand.selected { border-color: #f1c40f; box-shadow: 0 0 10px #f1c40f; transform: scale(1.05); }
.card-in-hand:not(.affordable) { opacity: 0.5; cursor: not-allowed; }
</style>