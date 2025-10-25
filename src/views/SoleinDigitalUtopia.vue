<template>
  <div class="utopia-container">
    <canvas ref="canvasRef" class="main-canvas"></canvas>

    <div v-if="isLoading" class="loading-overlay">
      </div>

    <div id="joystick-zone" class="joystick-zone"></div>
    <div class="chat-ui">
     </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// [수정] OrbitControls 제거 또는 주석 처리 (조이스틱과 충돌 방지)
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { auth, db, rtdb } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import {
  ref as dbRef, onChildAdded, onChildChanged, onChildRemoved,
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove
} from 'firebase/database';
// ▼▼▼ nipplejs import 추가 ▼▼▼
import nipplejs from 'nipplejs';
// ▲▲▲

// --- 상태 변수 ---
const canvasRef = ref(null);
const isLoading = ref(true);
const loadingMessage = ref('유토피아 입장 준비 중...');
const isReady = ref(false);

// --- 아바타 관련 ---
let myAvatar = null;
const otherPlayers = reactive({});
let myAvatarUrl = '';
let myUserName = '';

// --- 채팅 관련 ---
const chatInput = ref('');
const chatMessages = ref([]);
const messageListRef = ref(null);
const MAX_CHAT_MESSAGES = 50;

// --- Three.js 관련 ---
// [수정] controls 변수 제거 또는 주석 처리
let scene, camera, renderer, /* controls, */ clock;
const loader = new GLTFLoader();

// --- Firebase RTDB 경로 ---
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
let playerRef = null;
let playersListenerRef = null;
let chatListenerRef = null;

// --- 플레이어 이동 관련 ---
const moveSpeed = 1.5;
const rotateSpeed = Math.PI / 2;
const keysPressed = {};
// ▼▼▼ 조이스틱 상태 저장을 위한 ref 추가 ▼▼▼
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 });
let joystickManager = null; // 조이스틱 인스턴스
// ▲▲▲

// --- Helper 함수: 아바타 로드 ---
const loadAvatar = (url) => {
  return new Promise((resolve, reject) => {
    if (!url) {
      // URL 없으면 기본 아바타 (Cube)
      console.warn("Avatar URL not found, using default cube.");
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.y = 0.5;
      resolve(cube); // 기본 큐브는 복제할 필요 없음
      return;
    }
    loader.load(url,
      (gltf) => {
        // ▼▼▼ [핵심 수정] 로드된 씬을 복제하여 반환 ▼▼▼
        const model = gltf.scene.clone(); // .clone() 추가!
        // ▲▲▲

        // 모델 크기 및 위치 조정
        model.scale.set(0.7, 0.7, 0.7);
        model.position.y = 0; // 바닥에 맞춤

        // (선택 사항) 복제된 모델의 그림자 설정 (원본 gltf에 설정되어 있어도 복제 시 다시 해주는 것이 안전)
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true; // 필요에 따라 설정
          }
        });

        resolve(model); // 복제된 모델 반환
      },
      undefined,
      (error) => {
        console.error('아바타 로딩 실패:', error);
        reject(error);
      }
    );
  });
};

// --- Firebase RTDB 함수 ---
const joinPlaza = async () => {
  if (!auth.currentUser || !myAvatar) return;
  const uid = auth.currentUser.uid;
  playerRef = dbRef(rtdb, `${plazaPlayersPath}/${uid}`);

  const playerData = {
    avatarUrl: myAvatarUrl,
    userName: myUserName, // 채팅용 이름 추가
    position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(), // 마지막 업데이트 시간 (선택 사항)
  };

  try {
    await set(playerRef, playerData);
    await onDisconnect(playerRef).remove(); // 연결 끊어지면 자동 제거 설정
    console.log('Plaza 입장 완료');
    isReady.value = true; // 이동 및 채팅 가능 상태
  } catch (error) {
    console.error("Plaza 입장 실패:", error);
    isLoading.value = true; // 오류 시 로딩 상태로 유지 (혹은 에러 처리)
    loadingMessage.value = "입장에 실패했습니다.";
  }
};

const updateMyStateInRTDB = () => {
  if (!playerRef || !myAvatar || !isReady.value) return;

  const newState = {
    position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(),
  };
  // RTDB 업데이트 (avatarUrl, userName은 변경되지 않으므로 제외)
  set(playerRef, { ...newState, avatarUrl: myAvatarUrl, userName: myUserName });
};

// 주기적으로 내 상태 업데이트 (Throttling)
let lastUpdateTime = 0;
const updateInterval = 100; // 100ms 간격 (1초에 10번)

const throttledUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    updateMyStateInRTDB();
    lastUpdateTime = now;
  }
};

const listenToOtherPlayers = () => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  const uid = auth.currentUser.uid;

  // 새로운 플레이어 입장
  onChildAdded(playersListenerRef, async (snapshot) => {
    const userId = snapshot.key;
    if (userId === uid || otherPlayers[userId]) return; // 본인이거나 이미 있으면 무시

    loadingMessage.value = `플레이어 ${snapshot.val().userName || userId} 로딩 중...`;
    isLoading.value = true;

    const playerData = snapshot.val();
    try {
      const avatarMesh = await loadAvatar(playerData.avatarUrl);
      scene.add(avatarMesh);
      avatarMesh.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
      avatarMesh.rotation.y = playerData.rotationY;

      otherPlayers[userId] = {
        mesh: avatarMesh,
        targetPosition: new THREE.Vector3().copy(avatarMesh.position), // 초기 타겟 위치 설정
        targetRotationY: avatarMesh.rotation.y, // 초기 타겟 회전 설정
      };
      console.log(`${playerData.userName || userId} 입장`);
    } catch (error) {
      console.error(`플레이어 ${userId} 아바타 로딩 실패:`, error);
    } finally {
      isLoading.value = false;
    }
  });

  // 플레이어 상태 변경 (위치, 회전)
  onChildChanged(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === uid || !otherPlayers[userId]) return; // 본인이거나 없으면 무시

    const playerData = snapshot.val();
    const player = otherPlayers[userId];

    // 즉시 이동 대신 목표 위치/회전 업데이트 (부드러운 이동을 위해)
    player.targetPosition.set(playerData.position.x, playerData.position.y, playerData.position.z);
    player.targetRotationY = playerData.rotationY;
  });

  // 플레이어 퇴장
  onChildRemoved(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === uid || !otherPlayers[userId]) return; // 본인이거나 없으면 무시

    scene.remove(otherPlayers[userId].mesh);
    // Three.js 메모리 해제 (Geometry, Material 등)
    if (otherPlayers[userId].mesh.geometry) otherPlayers[userId].mesh.geometry.dispose();
    if (otherPlayers[userId].mesh.material) {
      if (Array.isArray(otherPlayers[userId].mesh.material)) {
        otherPlayers[userId].mesh.material.forEach(m => m.dispose());
      } else {
        otherPlayers[userId].mesh.material.dispose();
      }
    }
    delete otherPlayers[userId];
    console.log(`플레이어 ${userId} 퇴장`);
  });
};

// --- 채팅 함수 ---
const sendMessage = () => {
  if (!chatInput.value.trim() || !isReady.value || !auth.currentUser) return;

  const chatMessage = {
    userId: auth.currentUser.uid,
    userName: myUserName || '익명', // 사용자 이름 필요
    message: chatInput.value.trim(),
    timestamp: serverTimestamp(),
  };

  push(dbRef(rtdb, plazaChatPath), chatMessage);
  chatInput.value = '';
};

const listenToChat = () => {
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES)); // 최근 메시지만 가져오기
  let initialLoadComplete = false;
  const startTime = Date.now(); // 현재 시간 이후 메시지만 받도록 필터링

  onChildAdded(chatListenerRef, (snapshot) => {
    // 페이지 로드 시 이전 메시지 로딩 방지 (선택 사항)
    // if (!initialLoadComplete) return;

    // 좀 더 정확하게 현재 시간 이후 메시지만 받도록 수정
     const messageData = snapshot.val();
     if (messageData.timestamp < startTime && !initialLoadComplete) {
       return; // 초기 로드 중 이전 메시지 무시
     }

    chatMessages.value.push({ id: snapshot.key, ...snapshot.val() });
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) {
      chatMessages.value.shift(); // 오래된 메시지 제거
    }
    // 스크롤 맨 아래로 이동
    nextTick(() => {
      if (messageListRef.value) {
        messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
      }
    });
  });

  // 초기 로드가 완료되었다고 가정 (필요 시 더 정교한 로직 추가 가능)
  // setTimeout(() => { initialLoadComplete = true; }, 1000); // 1초 후부터 새 메시지 받기 시작
   initialLoadComplete = true; // 바로 새 메시지 받기 시작
};

// --- Three.js 초기화 함수 ---
const initThree = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 3);

  renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  // 조명, 바닥 등은 이전과 동일
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7.5);
  dirLight.castShadow = true;
  scene.add(dirLight);
  const groundGeometry = new THREE.PlaneGeometry(20, 20);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x99cc99, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // [수정] OrbitControls 초기화 제거 또는 주석 처리
  // controls = new OrbitControls(camera, renderer.domElement);
  // controls.target.set(0, 1, 0);
  // controls.enablePan = false;
  // controls.maxPolarAngle = Math.PI / 2 - 0.1;
  // controls.update();

  clock = new THREE.Clock();
};

// --- 플레이어 이동 로직 ---
const handleKeyDown = (event) => { keysPressed[event.key.toLowerCase()] = true; };
const handleKeyUp = (event) => { keysPressed[event.key.toLowerCase()] = false; };

// ▼▼▼ 조이스틱 이벤트 핸들러 추가 ▼▼▼
const handleJoystickMove = (evt, data) => {
  joystickData.value.active = true;
  joystickData.value.angle = data.angle.radian;
  joystickData.value.distance = data.distance; // 조이스틱 거리 (최대값은 옵션에 따라 다름)
  joystickData.value.force = data.force; // 조이스틱 힘 (0 ~ 1) - 속도 조절에 사용 가능
};

const handleJoystickEnd = () => {
  joystickData.value.active = false;
  joystickData.value.distance = 0;
  joystickData.value.force = 0;
};
// ▲▲▲

const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value) return;

  let moved = false;
  const moveDistance = moveSpeed * deltaTime;
  const rotateAngle = rotateSpeed * deltaTime;

  // ▼▼▼ 조이스틱 이동 처리 ▼▼▼
  if (joystickData.value.active) {
    // 1. 회전: 조이스틱 각도에 따라 아바타의 목표 회전값을 설정 (부드럽게 회전)
    // Three.js의 Y축은 위쪽, 각도는 오른쪽(X+)이 0, 위쪽(Z-)이 PI/2 ...
    // NippleJS의 각도는 오른쪽이 0, 위쪽이 PI/2 * 3 ... (좌표계 다름 주의)
    const targetRotationY = -joystickData.value.angle + Math.PI / 2; // NippleJS 각도를 Three.js Y 회전으로 변환 (필요시 조정)

    // 현재 회전값과 목표 회전값 사이를 부드럽게 보간 (Lerp)
    // 각도 차이가 180도를 넘지 않도록 보정 (shortest angle)
    let currentY = myAvatar.rotation.y;
    let targetY = targetRotationY;
    const PI2 = Math.PI * 2;
    // Normalize angles to be within [0, 2PI)
    currentY = (currentY % PI2 + PI2) % PI2;
    targetY = (targetY % PI2 + PI2) % PI2;

    let diff = targetY - currentY;
    if (Math.abs(diff) > Math.PI) {
      diff = diff > 0 ? diff - PI2 : diff + PI2;
    }

    myAvatar.rotation.y += diff * deltaTime * 5; // 숫자가 클수록 회전이 빠름

    // 2. 이동: 조이스틱 힘(force)에 따라 아바타 앞 방향으로 이동
    const forwardSpeed = moveSpeed * joystickData.value.force; // 힘에 비례한 속도
    myAvatar.translateX(-forwardSpeed * deltaTime); // 모델 앞 방향 (-X축 가정)
    // 또는 myAvatar.translateZ(-forwardSpeed * deltaTime); // 모델 앞 방향 (-Z축 가정)
    moved = true;
  }
  // ▲▲▲

  // ▼▼▼ 키보드 이동 처리 (PC용) ▼▼▼
  else {
    // 회전 (A, D)
    if (keysPressed['a']) { myAvatar.rotation.y += rotateAngle; moved = true; }
    if (keysPressed['d']) { myAvatar.rotation.y -= rotateAngle; moved = true; }
    // 이동 (W, S)
    if (keysPressed['w']) { myAvatar.translateX(-moveDistance); moved = true; } // 또는 translateZ
    if (keysPressed['s']) { myAvatar.translateX(moveDistance); moved = true; } // 또는 translateZ
  }
  // ▲▲▲

  // 경계 처리
  const boundary = 9.5;
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));

  if (moved) {
    throttledUpdate();
  }
};

// --- 다른 플레이어 부드러운 이동 처리 ---
const updateOtherPlayersMovement = (deltaTime) => { /* ... 이전 코드와 동일 ... */ };

// --- 애니메이션 루프 ---
const animate = () => {
  if (!renderer) return;
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);

  // [수정] controls.update() 제거 또는 주석 처리
  // controls.update();
  renderer.render(scene, camera);
};

// --- 창 크기 조절 처리 ---
const handleResize = () => { /* ... 이전 코드와 동일 ... */ };

// --- 컴포넌트 라이프사이클 훅 ---
onMounted(async () => {
  // ... (사용자 인증, Three.js 초기화, 사용자 정보/아바타 로드 로직은 이전과 동일) ...
  if (!auth.currentUser) { isLoading.value = false; return; }
  const uid = auth.currentUser.uid;
  initThree();
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown); // PC 키보드 리스너 유지
  window.addEventListener('keyup', handleKeyUp);     // PC 키보드 리스너 유지
  animate();

  loadingMessage.value = '내 정보 로딩 중...';
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) { myAvatarUrl = userDoc.data().avatarUrl || ''; myUserName = userDoc.data().name || '익명'; }
    else { console.error("User document not found!"); /* 에러 처리 */ }
  } catch (error) { console.error("Firestore user fetch failed:", error); loadingMessage.value = '내 정보 로딩 실패.'; return; }

  loadingMessage.value = '내 아바타 로딩 중...';
  try {
    myAvatar = await loadAvatar(myAvatarUrl);
    scene.add(myAvatar);
  } catch (error) { loadingMessage.value = '아바타 로딩 실패.'; if (!myAvatar) return; }

  // ▼▼▼ 조이스틱 초기화 추가 ▼▼▼
  const joystickZone = document.getElementById('joystick-zone');
  if (joystickZone) {
    joystickManager = nipplejs.create({
      zone: joystickZone,
      mode: 'static', // 'dynamic' 또는 'semi' 도 가능
      position: { left: '80px', bottom: '80px' }, // 화면 좌하단 위치
      color: 'rgba(255, 255, 255, 0.5)', // 조이스틱 색상
      size: 100 // 조이스틱 크기
    });
    joystickManager.on('move', handleJoystickMove);
    joystickManager.on('end', handleJoystickEnd);
  } else {
    console.warn("Joystick zone element not found.");
  }
  // ▲▲▲

  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza();
  listenToOtherPlayers();
  listenToChat();
  isLoading.value = false;
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);
  if (playerRef) remove(playerRef);

  // ▼▼▼ 조이스틱 제거 추가 ▼▼▼
  if (joystickManager) {
    joystickManager.off('move', handleJoystickMove);
    joystickManager.off('end', handleJoystickEnd);
    joystickManager.destroy();
  }
  // ▲▲▲

  // ... (Three.js 리소스 정리 로직은 이전과 동일) ...
  if (renderer) { renderer.dispose(); renderer = null; }
  if (scene) { /* ... scene traverse ... */ scene = null; }
  camera = null; /* controls = null; */ clock = null; myAvatar = null;
  Object.keys(otherPlayers).forEach(key => delete otherPlayers[key]);
});

</script>

<style scoped>
.utopia-container {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden; /* 스크롤바 방지 */
  position: relative; /* 자식 요소 position 기준 */
}

.main-canvas {
  display: block; /* 기본 마진 제거 */
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #fff;
  animation: spin 1s ease infinite;
  margin-bottom: 15px;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.chat-ui {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 300px;
  max-height: 40%; /* 최대 높이 제한 */
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  z-index: 5;
}

.message-list {
  flex-grow: 1;
  overflow-y: auto; /* 스크롤 가능하게 */
  margin-bottom: 10px;
  color: white;
  font-size: 0.9em;
}

.chat-message {
  margin-bottom: 5px;
  word-break: break-all; /* 긴 메시지 줄바꿈 */
}
.chat-message strong {
  color: #f1c40f; /* 유저 이름 색상 */
}

.chat-ui input {
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  outline: none;
}
.chat-ui input:disabled {
  background-color: rgba(255, 255, 255, 0.1);
  cursor: not-allowed;
}
/* ▼▼▼ 조이스틱 영역 스타일 추가 ▼▼▼ */
.joystick-zone {
  position: absolute;
  bottom: 30px; /* 채팅창과 겹치지 않도록 조정 */
  left: 30px;
  width: 150px; /* 조이스틱 최대 이동 범위 */
  height: 150px;
  /* background-color: rgba(255, 0, 0, 0.1); */ /* 영역 확인용 (디버깅 시 사용) */
  z-index: 6; /* 채팅창 위에 오도록 */
}
/* ▲▲▲ */
</style>