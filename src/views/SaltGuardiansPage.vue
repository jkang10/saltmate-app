<template>
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
            <div v-for="upgrade in upgrades" :key="upgrade.id" class="upgrade-item">
              <div class="upgrade-info">
                <strong>{{ upgrade.name }} (Lv. {{ upgrade.level }})</strong>
                <small>{{ upgrade.desc }}</small>
              </div>
              <button @click="buyUpgrade(upgrade.id)" :disabled="isProcessing" class="upgrade-button">
                {{ upgrade.cost.toLocaleString() }} SP
              </button>
            </div>
          </div>
        </div>
        <div class="card ranking-section">
          <h3><i class="fas fa-trophy"></i> 일일 랭킹 TOP 5</h3>
          <div class="no-data">랭킹 정보를 불러오는 중...</div>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "@/firebaseConfig";
// (이하 필요한 Firebase import 구문 추가)

// --- 상태 변수 ---
const gameCanvas = ref(null);
const gameState = ref('ready'); // ready, playing, ended
const isProcessing = ref(false);
const score = ref(0);
const wave = ref(0);
const awardedPoints = ref(0);

const crystal = reactive({ hp: 100, maxHp: 100, x: 0, y: 0, radius: 30 });
const player = reactive({ x: 0, y: 0, radius: 20, speed: 5, shootCooldown: 0 });
const upgrades = reactive({ /* 업그레이드 정보 */ });

let projectiles = [];
let monsters = [];
let particles = [];
let keys = {};
let ctx = null;
let animationFrameId = null;

// --- 게임 로직 ---
const startGame = async () => {
  isProcessing.value = true;
  try {
    // [서버 연동] 입장료 차감 함수 호출 (3단계에서 생성)
    // const startFunc = httpsCallable(functions, 'startSaltGuardiansGame');
    // await startFunc();

    // 초기화
    score.value = 0;
    wave.value = 1;
    crystal.hp = crystal.maxHp;
    projectiles = [];
    monsters = [];
    player.shootCooldown = 20; // 초기 발사 딜레이

    gameState.value = 'playing';
    isProcessing.value = false;
  } catch (error) {
    alert(`게임 시작 실패: ${error.message}`);
    isProcessing.value = false;
  }
};

const endGame = () => {
  gameState.value = 'ended';
  // [서버 연동] 점수 전송 및 보상 획득 함수 호출 (3단계에서 생성)
  // const endFunc = httpsCallable(functions, 'endSaltGuardiansGame');
  // endFunc({ score: score.value }).then(result => {
  //   awardedPoints.value = result.data.awardedPoints;
  // });
};

const spawnMonsters = () => {
  if (monsters.length === 0) {
    wave.value++;
    for (let i = 0; i < wave.value * 2; i++) {
      const x = Math.random() * gameCanvas.value.width;
      const y = -30;
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
  if (gameState.value !== 'playing') {
    if(animationFrameId) cancelAnimationFrame(animationFrameId);
    return;
  }
  animationFrameId = requestAnimationFrame(gameLoop);
  
  // 그리기
  ctx.fillStyle = 'rgba(27, 40, 56, 0.2)';
  ctx.fillRect(0, 0, gameCanvas.value.width, gameCanvas.value.height);

  // 플레이어 이동 및 발사
  if (keys['ArrowLeft'] && player.x > player.radius) player.x -= player.speed;
  if (keys['ArrowRight'] && player.x < gameCanvas.value.width - player.radius) player.x += player.speed;
  if (player.shootCooldown > 0) player.shootCooldown--;
  if (player.shootCooldown === 0) {
    projectiles.push({ x: player.x, y: player.y, radius: 5, speed: 7 });
    player.shootCooldown = 20; // 20프레임마다 발사
  }

  // 결정 그리기
  ctx.beginPath();
  ctx.arc(crystal.x, crystal.y, crystal.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#00d2ff';
  ctx.shadowColor = '#00d2ff';
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 플레이어 그리기
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ecf0f1';
  ctx.fill();

  // 발사체 업데이트 및 그리기
  projectiles.forEach((p, pIndex) => {
    p.y -= p.speed;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#f1c40f';
    ctx.fill();
    if (p.y < 0) projectiles.splice(pIndex, 1);
  });

  // 파티클(이펙트) 업데이트 및 그리기
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

  // 몬스터 생성 및 업데이트
  spawnMonsters();
  monsters.forEach((m, mIndex) => {
    const angle = Math.atan2(crystal.y - m.y, crystal.x - m.x);
    m.x += Math.cos(angle) * m.speed;
    m.y += Math.sin(angle) * m.speed;

    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();

    // 충돌 감지: 몬스터 vs 결정
    const distToCrystal = Math.hypot(m.x - crystal.x, m.y - crystal.y);
    if (distToCrystal - m.radius - crystal.radius < 1) {
      crystal.hp -= 10;
      createParticles(m.x, m.y, m.radius * 2, '#e74c3c');
      monsters.splice(mIndex, 1);
      if (crystal.hp <= 0) endGame();
    }
    
    // 충돌 감지: 몬스터 vs 발사체
    projectiles.forEach((p, pIndex) => {
      const dist = Math.hypot(p.x - m.x, p.y - m.y);
      if (dist - m.radius - p.radius < 1) {
        m.hp--;
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

  player.x = canvas.width / dpr / 2;
  player.y = canvas.height / dpr - 50;
  crystal.x = canvas.width / dpr / 2;
  crystal.y = canvas.height / dpr - 50;

  window.addEventListener('keydown', (e) => keys[e.key] = true);
  window.addEventListener('keyup', (e) => keys[e.key] = false);

  gameLoop();
});

onUnmounted(() => {
  if(animationFrameId) cancelAnimationFrame(animationFrameId);
  window.removeEventListener('keydown', (e) => keys[e.key] = true);
  window.removeEventListener('keyup', (e) => keys[e.key] = false);
});
</script>

<style scoped>
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