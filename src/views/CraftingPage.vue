<template>
  <div class="crafting-page-container">
    <header class="page-header">
      <i class="fas fa-hammer title-icon"></i>
      <h2 class="title">솔레인 제작 공방</h2>
      <p class="description">다양한 게임에서 획득한 재료를 조합하여 특별한 아이템을 만들어보세요.</p>
    </header>

    <div v-if="loading" class="loading-spinner"></div>
    <div v-else class="recipes-grid">
      <div v-for="recipe in recipes" :key="recipe.id" class="recipe-card" :class="{ 'locked': !isUnlocked(recipe) }">
        <div class="card-header">
          <span class="recipe-icon">{{ recipe.icon }}</span>
          <div class="recipe-title">
            <h3>{{ recipe.itemName }}</h3>
            <span v-if="!isUnlocked(recipe)" class="lock-info">
              <i class="fas fa-lock"></i> 공방 Lv.{{ recipe.unlockLevel }} 필요
            </span>
          </div>
        </div>
        <div class="card-body">
          <p class="recipe-description">{{ recipe.description }}</p>
          <ul class="ingredients-list">
            <li v-for="ing in recipe.ingredients" :key="ing.resource" :class="{ 'sufficient': hasEnough(ing) }">
              <span class="ingredient-name">{{ ing.name }}</span>
              <span class="ingredient-amount">
                ({{ getMyAmount(ing).toLocaleString() }} / {{ ing.amount.toLocaleString() }})
              </span>
            </li>
          </ul>
        </div>
        <div class="card-footer">
          <button @click="craft(recipe.id)" class="craft-button" :disabled="!canCraft(recipe) || craftingId === recipe.id">
            <span v-if="craftingId === recipe.id">제작 중...</span>
            <span v-else>제작하기</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import { db, functions, auth } from '@/firebaseConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const recipes = ref([]);
const inventory = reactive({});
const loading = ref(true);
const craftingId = ref(null);

const fetchAllData = async () => {
  loading.value = true;
  try {
    const uid = auth.currentUser.uid;
    const [recipesSnap, userDoc, saltMineDoc, deepSeaDoc] = await Promise.all([
      getDocs(collection(db, "craftingRecipes")),
      getDoc(doc(db, "users", uid)),
      getDoc(doc(db, "users", uid, "game_state", "salt_mine")),
      getDoc(doc(db, "users", uid, "game_state", "deep_sea_exploration"))
    ]);

    recipes.value = recipesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const userData = userDoc.exists() ? userDoc.data() : {};
    const saltMineData = saltMineDoc.exists() ? saltMineDoc.data() : {};
    const deepSeaData = deepSeaDoc.exists() ? deepSeaDoc.data() : {};

    Object.assign(inventory, {
      salt: saltMineData.salt || 0,
      gold: saltMineData.gold || 0,
      workshopLevel: saltMineData.workshopLevel || 1,
      minerals: deepSeaData.minerals || 0,
      relics: deepSeaData.relics || 0,
      saltmatePoints: userData.saltmatePoints || 0,
    });
  } catch (error) {
    console.error("데이터 로딩 실패:", error);
  } finally {
    loading.value = false;
  }
};

const getMyAmount = (ingredient) => {
  if (ingredient.type === 'salt_mine' || ingredient.type === 'deep_sea') {
    return inventory[ingredient.resource] || 0;
  }
  if (ingredient.type === 'global') {
    return inventory[ingredient.resource] || 0;
  }
  return 0;
};

const hasEnough = (ingredient) => {
  return getMyAmount(ingredient) >= ingredient.amount;
};

const isUnlocked = (recipe) => {
  return (inventory.workshopLevel || 1) >= recipe.unlockLevel;
};

const canCraft = (recipe) => {
  if (!isUnlocked(recipe)) return false;
  return recipe.ingredients.every(ing => hasEnough(ing));
};

const craft = async (recipeId) => {
  if (craftingId.value) return;
  craftingId.value = recipeId;
  try {
    const craftFunc = httpsCallable(functions, 'craftItem');
    const result = await craftFunc({ recipeId });
    alert(`성공: ${result.data.message}`);
    await fetchAllData(); // 제작 후 데이터 새로고침
  } catch (error) {
    alert(`제작 실패: ${error.message}`);
  } finally {
    craftingId.value = null;
  }
};

onMounted(fetchAllData);
</script>

<style scoped>
.crafting-page-container {
  min-height: calc(100vh - 70px);
  padding: 40px 20px;
  background: linear-gradient(135deg, #2c3e50, #34495e);
  color: #ecf0f1;
}
.page-header { text-align: center; margin-bottom: 40px; }
.title-icon { font-size: 3em; color: #f1c40f; margin-bottom: 15px; text-shadow: 0 0 15px #f1c40f; }
.title { font-size: 2.5em; font-weight: 700; margin-bottom: 10px; }
.description { font-size: 1.1em; color: #bdc3c7; max-width: 600px; margin: 0 auto; }
.loading-spinner { /* ... */ }

.recipes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 30px;
  max-width: 1200px;
  margin: 0 auto;
}
.recipe-card {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 15px;
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}
.recipe-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 30px rgba(0,0,0,0.3);
}
.recipe-card.locked {
  opacity: 0.6;
  filter: grayscale(80%);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.recipe-icon { font-size: 2.5em; }
.recipe-title h3 { margin: 0; font-size: 1.5em; }
.lock-info { font-size: 0.9em; color: #e74c3c; font-weight: bold; }
.card-body { padding: 20px; flex-grow: 1; }
.recipe-description { font-size: 1em; color: #bdc3c7; margin-top: 0; }
.ingredients-list {
  list-style: none;
  padding: 0;
  margin: 20px 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ingredients-list li {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: rgba(0,0,0,0.2);
  border-radius: 6px;
  color: #e74c3c; /* 기본적으로는 부족한 색상 */
}
.ingredients-list li.sufficient {
  color: #2ecc71; /* 충분할 때 색상 */
}
.ingredient-name { font-weight: 500; }
.ingredient-amount { font-family: monospace; }
.card-footer { padding: 20px; }
.craft-button {
  width: 100%;
  padding: 15px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  border-radius: 8px;
  border: none;
  background: linear-gradient(145deg, #f1c40f, #e67e22);
  color: white;
  transition: all 0.3s ease;
}
.craft-button:disabled {
  background: #7f8c8d;
  cursor: not-allowed;
}
.craft-button:hover:not(:disabled) {
  transform: scale(1.02);
}
</style>