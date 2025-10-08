2025-10-07<template>
  <div class="guardians-page">
    <header class="page-header">
      <h1><i class="fas fa-shield-alt"></i> 솔트 가디언즈</h1>
      <p>오염수 몬스터로부터 '정화의 소금 결정'을 지켜내세요!</p>
    </header>

    <main class="game-layout">
      <div class="game-screen-wrapper card">
        <canvas ref="gameCanvas"></canvas>
        <div v-if="gameState === 'ready'" class="game-overlay ready">
          <h2>SALT GUARDIANS</h2>
          <button @click="startGame" class="game-button" :disabled="isProcessing">
            <span v-if="isProcessing" class="spinner-small"></span>
            <span v-else>도전 시작 (입장료: 200 SaltMate)</span>
          </button>
        </div>
        <div v-if="gameState === 'ended'" class="game-overlay ended">
          <h2>GAME OVER</h2>
          <p>최종 점수: <strong>{{ score.toLocaleString() }}</strong></p>
          <p>획득 보상: <strong>{{ awardedPoints.toLocaleString() }} SaltMate</strong></p>
          <div class="button-group">
            <button @click="startGame" class="game-button">다시 도전</button>
            <button @click="gameState = 'ready'" class="game-button secondary">연구소로</button>
          </div>
        </div>
        <div v-if="gameState === 'playing'" class="game-ui">
          <div class="stat">점수: {{ score.toLocaleString() }}</div>
          <div class="stat">웨이브: {{ wave }}</div>
          <div class="stat crystal-hp">
            <span>결정 HP</span>
            <div class="hp-bar">
              <div class="hp-fill" :style="{ width: `${(crystal.hp / crystal.maxHp) * 100}%` }"></div>
            </div>
          </div>
        </div>
      </div>

      <aside class="side-panel">
<div class="card lab-section">
  <h3><i class="fas fa-flask"></i> 수호자 연구소</h3>
  <div class="upgrade-list">
    <div v-for="upgrade in upgradeItems" :key="upgrade.id" class="upgrade-item">
      <div class="upgrade-info">
        <strong>{{ upgrade.name }} (Lv. {{ upgrade.level }})</strong>
        <small>{{ upgrade.desc }}</small>
      </div>
      <button @click="buyUpgrade(upgrade.id)" :disabled="isProcessing" class="upgrade-button">
        {{ upgrade.cost.toLocaleString() }} SaltMate
      </button>
    </div>
  </div>
</div>
<div class="card ranking-section">
  <h3><i class="fas fa-trophy"></i> 일일 랭킹 TOP 5</h3>
  <div v-if="isLoadingRankings" class="loading-state">
    <div class="spinner-small"></div>
  </div>
  <ul v-else-if="dailyRankings.length > 0" class="ranking-list">
    <li v-for="(player, index) in dailyRankings" :key="player.userId" :class="['rank-item', 'rank-' + (index + 1)]">
      <div class="rank-badge">
        <i v-if="index === 0" class="fas fa-crown"></i>
        <span v-else>{{ index + 1 }}</span>
      </div>
      <div class="player-info">
        <span class="player-name">{{ player.userName }}</span>
        <span class="player-score">{{ player.score.toLocaleString() }}점</span>
      </div>
    </li>
  </ul>
  <div v-else class="no-data">
    오늘의 랭킹 정보가 아직 없습니다.
  </div>
</div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { httpsCallable, getFunctions } from "firebase/functions";
import { auth, db } from "@/firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';


// --- 상태 변수 ---
const gameCanvas = ref(null);
const gameState = ref('ready'); // ready, playing, ended
const isProcessing = ref(false);
const score = ref(0);
const wave = ref(0);
const awardedPoints = ref(0);

// ▼▼▼ 이 두 변수를 추가해주세요 ▼▼▼
const dailyRankings = ref([]);
const isLoadingRankings = ref(true);

const crystal = reactive({ hp: 100, maxHp: 100, x: 0, y: 0, radius: 30 });
const player = reactive({ x: 0, y: 0, radius: 20, speed: 5, shootCooldown: 0, fireRate: 20, damage: 1 });

// [수정] 업그레이드 데이터 구조화
const upgrades = reactive({
  damage: { level: 0, name: '공격력 강화', desc: '발사체 공격력 증가', baseCost: 100 },
  fireRate: { level: 0, name: '연사 속도 향상', desc: '발사체 발사 속도 증가', baseCost: 150 },
  crystalHp: { level: 0, name: '결정 내구도 증가', desc: '소금 결정의 최대 HP 증가', baseCost: 120 },
});

// 업그레이드 비용 계산
const upgradeItems = computed(() => Object.keys(upgrades).map(id => {
    const upg = upgrades[id];
    return {
        ...upg,
        id,
        cost: Math.floor(upg.baseCost * Math.pow(1.5, upg.level))
    };
}));

let projectiles = [];
let monsters = [];
let particles = [];
let keys = {};
let ctx = null;
let animationFrameId = null;

// --- 모바일 터치 상태 ---
const touchState = reactive({
  active: false,
  startX: 0,
  currentX: 0,
});

// ▼▼▼ 이 함수들을 추가해주세요 ▼▼▼
const handleTouchStart = (event) => {
  if (gameState.value !== 'playing') return;
  touchState.active = true;
  touchState.startX = event.touches[0].clientX;
  touchState.currentX = event.touches[0].clientX;
};

const handleTouchMove = (event) => {
  if (!touchState.active || gameState.value !== 'playing') return;
  touchState.currentX = event.touches[0].clientX;

  // 드래그 거리에 비례하여 플레이어 위치 업데이트
  const deltaX = touchState.currentX - touchState.startX;
  const newPlayerX = player.x + deltaX;

  // 캔버스 경계 체크
  const canvasWidth = gameCanvas.value.getBoundingClientRect().width;
  player.x = Math.max(player.radius, Math.min(canvasWidth - player.radius, newPlayerX));

  // 다음 이동 계산을 위해 시작점 업데이트
  touchState.startX = touchState.currentX;
};

const handleTouchEnd = () => {
  touchState.active = false;
};
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// --- 게임 로직 ---
const startGame = async () => {
  isProcessing.value = true;
  try {
    const functionsWithRegion = getFunctions(auth.app, "asia-northeast3");
    const startFunc = httpsCallable(functionsWithRegion, 'startSaltGuardiansGame');
    await startFunc();

    score.value = 0;
    wave.value = 1;
    crystal.hp = crystal.maxHp;
    projectiles = [];
    monsters = [];
    player.shootCooldown = player.fireRate;

    gameState.value = 'playing';
    isProcessing.value = false;
    gameLoop(); // 게임 루프 시작
  } catch (error) {
    alert(`게임 시작 실패: ${error.message}`);
    isProcessing.value = false;
  }
};

const endGame = async () => {
  if (gameState.value === 'ended') return;
  gameState.value = 'ended';

  try {
    const functionsWithRegion = getFunctions(auth.app, "asia-northeast3");
    const endFunc = httpsCallable(functionsWithRegion, 'endSaltGuardiansGame');
    const result = await endFunc({ score: score.value });
    awardedPoints.value = result.data.awardedPoints;
  } catch (error) {
    console.error("게임 결과 전송 실패:", error);
  }
};

// onMounted 함수 바로 아래에, 아래 fetchDailyRankings 함수 전체를 추가해주세요.
const fetchDailyRankings = async () => {
  isLoadingRankings.value = true;
  try {
    const kstOffset = 9 * 60 * 60 * 1000;
    const today = new Date(new Date().getTime() + kstOffset).toISOString().slice(0, 10);

    const q = query(
      collection(db, `leaderboards/salt_guardians_daily/${today}`),
      orderBy("score", "desc"),
      limit(5)
    );
    const snapshot = await getDocs(q);
    dailyRankings.value = snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("솔트 가디언즈 일일 랭킹 로딩 오류:", error);
  } finally {
    isLoadingRankings.value = false;
  }
};

const buyUpgrade = async (upgradeId) => {
    isProcessing.value = true;
    try {
        const functionsWithRegion = getFunctions(auth.app, "asia-northeast3");
        const upgradeFunc = httpsCallable(functionsWithRegion, 'upgradeSaltGuardian');
        await upgradeFunc({ upgradeId });
        alert('업그레이드 성공!');
    } catch (error) {
        alert(`업그레이드 실패: ${error.message}`);
    } finally {
        isProcessing.value = false;
    }
};

const applyUpgrades = (upgradeData) => {
    if(!upgradeData) return;
    upgrades.damage.level = upgradeData.damage || 0;
    upgrades.fireRate.level = upgradeData.fireRate || 0;
    upgrades.crystalHp.level = upgradeData.crystalHp || 0;

    player.damage = 1 + (upgrades.damage.level * 0.2);
    player.fireRate = Math.max(5, 20 - upgrades.fireRate.level); // 최소 5프레임 딜레이
    crystal.maxHp = 100 + (upgrades.crystalHp.level * 20);
};

const spawnMonsters = () => {
  if (monsters.length === 0) {
    wave.value++;
    for (let i = 0; i < wave.value * 2; i++) {
      const x = Math.random() < 0.5 ? 0 - 30 : gameCanvas.value.width + 30;
      const y = Math.random() * gameCanvas.value.height * 0.6;
      const type = Math.random() > 0.8 ? 'fast' : 'normal';
      monsters.push({
        x, y,
        radius: type === 'fast' ? 15 : 20,
        speed: type === 'fast' ? 3 : 1.5,
        hp: type === 'fast' ? 1 : 3,
        color: type === 'fast' ? '#e74c3c' : '#9b59b6',
      });
    }
  }
};

const createParticles = (x, y, count, color) => {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      radius: Math.random() * 3,
      velocity: { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 },
      alpha: 1,
      color: color,
    });
  }
};

const gameLoop = () => {
  animationFrameId = requestAnimationFrame(gameLoop);
  if (gameState.value !== 'playing') return;
  
  const canvas = gameCanvas.value;
  
  ctx.fillStyle = 'rgba(27, 40, 56, 0.2)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 플레이어 이동 (키보드)
  if (keys['ArrowLeft'] && player.x > player.radius) player.x -= player.speed;
  if (keys['ArrowRight'] && player.x < gameCanvas.value.width / (window.devicePixelRatio || 1) - player.radius) player.x += player.speed;
  if (player.shootCooldown > 0) player.shootCooldown--;
  if (player.shootCooldown === 0) {
    projectiles.push({ x: player.x, y: player.y, radius: 5, speed: 7 });
    player.shootCooldown = player.fireRate;
  }

  // Draw Crystal
  ctx.beginPath();
  ctx.arc(crystal.x, crystal.y, crystal.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#00d2ff';
  ctx.shadowColor = '#00d2ff';
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Draw Player
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ecf0f1';
  ctx.fill();

  particles.forEach((p, pIndex) => {
    p.x += p.velocity.x;
    p.y += p.velocity.y;
    p.alpha -= 0.02;
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (p.alpha <= 0) particles.splice(pIndex, 1);
  });

  projectiles.forEach((p, pIndex) => {
    p.y -= p.speed;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f1c40f';
    ctx.fill();
    if (p.y < 0) projectiles.splice(pIndex, 1);
  });

  spawnMonsters();
  monsters.forEach((m, mIndex) => {
    const angle = Math.atan2(crystal.y - m.y, crystal.x - m.x);
    m.x += Math.cos(angle) * m.speed;
    m.y += Math.sin(angle) * m.speed;

    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();

    const distToCrystal = Math.hypot(m.x - crystal.x, m.y - crystal.y);
    if (distToCrystal - m.radius - crystal.radius < 1) {
      crystal.hp -= 10;
      createParticles(m.x, m.y, m.radius * 2, '#e74c3c');
      monsters.splice(mIndex, 1);
      if (crystal.hp <= 0) endGame();
    }
    
    projectiles.forEach((p, pIndex) => {
      const dist = Math.hypot(p.x - m.x, p.y - m.y);
      if (dist - m.radius - p.radius < 1) {
        m.hp -= player.damage;
        createParticles(m.x, m.y, 8, '#f1c40f');
        projectiles.splice(pIndex, 1);
        if (m.hp <= 0) {
          score.value += 100;
          createParticles(m.x, m.y, m.radius * 2, '#9b59b6');
          monsters.splice(mIndex, 1);
        }
      }
    });
  });
};

// --- 라이프사이클 훅 ---
onMounted(() => {
  const canvas = gameCanvas.value;
  ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  player.x = rect.width / 2;
  player.y = rect.height - 50;
  crystal.x = rect.width / 2;
  crystal.y = rect.height - 50;

  // PC 키보드 이벤트 리스너 추가
  window.addEventListener('keydown', (e) => { if(e.key === 'ArrowLeft' || e.key === 'ArrowRight') keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { if(e.key === 'ArrowLeft' || e.key === 'ArrowRight') keys[e.key] = false; });

  // 모바일 터치 이벤트 리스너를 캔버스에 직접 추가
  canvas.addEventListener('touchstart', handleTouchStart);
  canvas.addEventListener('touchmove', handleTouchMove);
  canvas.addEventListener('touchend', handleTouchEnd);

  // Firestore에서 사용자의 업그레이드 정보를 실시간으로 가져옴
  if (auth.currentUser) {
    const guardianRef = doc(db, `users/${auth.currentUser.uid}/gamedata/saltGuardian`);
    onSnapshot(guardianRef, (docSnap) => {
    fetchDailyRankings();
        if (docSnap.exists()) {
            applyUpgrades(docSnap.data().upgrades);
        }
    });
  }

  // 게임 루프 시작
  gameLoop();
});

onUnmounted(() => {
  if(animationFrameId) cancelAnimationFrame(animationFrameId);
  
  // 키보드 이벤트 리스너 제거
  window.removeEventListener('keydown', (e) => { if(e.key === 'ArrowLeft' || e.key === 'ArrowRight') keys[e.key] = true; });
  window.removeEventListener('keyup', (e) => { if(e.key === 'ArrowLeft' || e.key === 'ArrowRight') keys[e.key] = false; });

  // 터치 이벤트 리스너 제거
  const canvas = gameCanvas.value;
  if (canvas) {
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', handleTouchEnd);
  }
});

</script>

<style scoped>
.ranking-section {
  background: linear-gradient(135deg, #e0eafc, #cfdef3);
}
.ranking-section h3 {
  color: #3b5998;
  font-weight: 700;
}
.ranking-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rank-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  transition: all 0.3s ease;
  border: 1px solid transparent;
}
.rank-item:hover {
  transform: scale(1.03);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}
.rank-badge {
  width: 30px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  font-size: 1.1em;
  color: #fff;
  background-color: #bdc3c7;
  border-radius: 50%;
  margin-right: 15px;
  flex-shrink: 0;
}
.player-info {
  flex-grow: 1;
  display: flex;
  justify-content: space-between;
}
.player-name {
  font-weight: 600;
  color: #2c3e50;
}
.player-score {
  font-weight: bold;
  color: #34495e;
}

/* TOP 3 특별 스타일 */
.rank-1 .rank-badge { background: #f1c40f; animation: pulse 1.5s infinite; } /* 금 */
.rank-2 .rank-badge { background: #bdc3c7; } /* 은 */
.rank-3 .rank-badge { background: #d35400; } /* 동 */

.rank-1, .rank-2, .rank-3 {
  border-color: #f1c40f;
  font-weight: bold;
}
.rank-1 .player-name, .rank-1 .player-score { color: #c0392b; }

@keyframes pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(241, 196, 15, 0.7); }
  70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(241, 196, 15, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(241, 196, 15, 0); }
}
.spinner-small {
    border: 3px solid rgba(0,0,0,0.1);
    border-top-color: #34495e;
    border-radius: 50%;
    width: 24px; height: 24px;
    animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.guardians-page {
  padding: 20px;
  background-color: #f0f2f5;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.5em;
  color: #1e3c72;
}
.page-header p {
  font-size: 1.1em;
  color: #475569;
}
.game-layout {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 30px;
  max-width: 1200px;
  margin: 0 auto;
}
@media (max-width: 992px) {
  .game-layout {
    grid-template-columns: 1fr;
  }
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 25px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.08);
}

.game-screen-wrapper {
  position: relative;
  padding: 0;
  overflow: hidden;
  height: 600px;
}
canvas {
  width: 100%;
  height: 100%;
  background: #1b2838;
}

.game-overlay {
  position: absolute;
  inset: 0;
  background: rgba(27, 40, 56, 0.9);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}
.game-overlay h2 {
  font-size: 4em;
  font-weight: 900;
  text-shadow: 0 0 20px #00d2ff;
}
.game-overlay p {
  font-size: 1.5em;
  margin: 10px 0;
}

.game-button {
  padding: 15px 40px;
  font-size: 1.2em;
  font-weight: bold;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #00d2ff, #3a7bd5);
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 20px;
}
.game-button:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(0, 210, 255, 0.3);
}
.game-button.secondary {
  background: #475569;
}
.button-group {
  display: flex;
  gap: 20px;
}

.game-ui {
  position: absolute;
  top: 15px;
  left: 15px;
  right: 15px;
  display: flex;
  justify-content: space-between;
  color: #fff;
  font-size: 1.2em;
  font-weight: bold;
  pointer-events: none;
}
.crystal-hp {
  width: 200px;
}
.hp-bar {
  width: 100%;
  height: 10px;
  background: rgba(255,255,255,0.3);
  border-radius: 5px;
  margin-top: 5px;
}
.hp-fill {
  height: 100%;
  background: #00d2ff;
  border-radius: 5px;
  transition: width 0.3s ease;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.lab-section h3, .ranking-section h3 {
  margin-top: 0;
  font-size: 1.5em;
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 20px;
}
.upgrade-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.upgrade-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
}
.upgrade-info strong { font-size: 1.1em; }
.upgrade-info small { color: #6c757d; }
.upgrade-button {
  padding: 8px 15px;
  font-weight: bold;
  background: #007bff;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
.no-data {
  text-align: center;
  color: #6c757d;
  padding: 20px;
}

.spinner-small {
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
    display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>