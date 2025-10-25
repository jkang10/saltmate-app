<template>
  <div class="utopia-container">
    <canvas ref="canvasRef" class="main-canvas"></canvas>

    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>{{ loadingMessage }}</p>
    </div>

    <div class="chat-ui">
      <div class="message-list" ref="messageListRef">
        <div v-for="msg in chatMessages" :key="msg.id" class="chat-message">
          <strong>{{ msg.userName }}:</strong> {{ msg.message }}
        </div>
      </div>
      <input
        type="text"
        v-model="chatInput"
        @keyup.enter="sendMessage"
        placeholder="메시지 입력..."
        :disabled="!isReady"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // 디버깅/초기 확인용
import { auth, db, rtdb } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import {
  ref as dbRef, onChildAdded, onChildChanged, onChildRemoved,
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove
} from 'firebase/database';

// --- 상태 변수 ---
const canvasRef = ref(null);
const isLoading = ref(true);
const loadingMessage = ref('유토피아 입장 준비 중...');
const isReady = ref(false); // 모든 로딩 및 설정 완료 여부

// --- 아바타 관련 ---
let myAvatar = null;
const otherPlayers = reactive({}); // { userId: { mesh: THREE.Group, targetPosition: THREE.Vector3, targetRotationY: number } }
let myAvatarUrl = '';
let myUserName = '';

// --- 채팅 관련 ---
const chatInput = ref('');
const chatMessages = ref([]); // { id: string, userName: string, message: string }
const messageListRef = ref(null);
const MAX_CHAT_MESSAGES = 50; // 최대 메시지 수

// --- Three.js 관련 ---
let scene, camera, renderer, controls, clock;
const loader = new GLTFLoader();

// --- Firebase RTDB 경로 ---
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
let playerRef = null; // 자신의 RTDB 플레이어 레퍼런스
let playersListenerRef = null; // 다른 플레이어 리스너 레퍼런스
let chatListenerRef = null; // 채팅 리스너 레퍼런스

// --- 플레이어 이동 관련 ---
const moveSpeed = 1.5;
const rotateSpeed = Math.PI / 2; // 초당 90도 회전
const keysPressed = {}; // 현재 눌린 키 상태

// --- Helper 함수: 아바타 로드 ---
const loadAvatar = (url) => {
  return new Promise((resolve, reject) => {
    if (!url) {
      // URL 없으면 기본 아바타 (여기서는 간단히 Cube로 대체)
      console.warn("Avatar URL not found, using default cube.");
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.y = 0.5; // 바닥 위에 서도록
      resolve(cube);
      return;
    }
    loader.load(url,
      (gltf) => {
        const model = gltf.scene;
        // 모델 크기 및 위치 조정 (필요 시)
        model.scale.set(0.7, 0.7, 0.7); // 예시 스케일
        model.position.y = 0; // 바닥에 맞춤
        resolve(model);
      },
      undefined, // Progress 콜백 (필요 시 구현)
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
  scene.background = new THREE.Color(0x87ceeb); // 하늘색 배경

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 3); // 카메라 위치 조정

  renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true; // 그림자 활성화

  // 조명
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 10, 7.5);
  dirLight.castShadow = true;
  scene.add(dirLight);

  // 바닥
  const groundGeometry = new THREE.PlaneGeometry(20, 20);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x99cc99, side: THREE.DoubleSide }); // 연두색 바닥
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 컨트롤 (디버깅용)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0); // 컨트롤 타겟 높이 조정
  controls.enablePan = false; // 팬 비활성화 (선택 사항)
  controls.maxPolarAngle = Math.PI / 2 - 0.1; // 카메라가 땅 밑으로 못가게
  controls.update();


  clock = new THREE.Clock(); // 애니메이션 루프용 시계
};

// --- 플레이어 이동 로직 ---
const handleKeyDown = (event) => { keysPressed[event.key.toLowerCase()] = true; };
const handleKeyUp = (event) => { keysPressed[event.key.toLowerCase()] = false; };

const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value) return;

  const moveDistance = moveSpeed * deltaTime;
  const rotateAngle = rotateSpeed * deltaTime;
  let moved = false;

  // 회전 (A, D)
  if (keysPressed['a']) {
    myAvatar.rotation.y += rotateAngle;
    moved = true;
  }
  if (keysPressed['d']) {
    myAvatar.rotation.y -= rotateAngle;
    moved = true;
  }

  // 이동 (W, S) - 아바타가 바라보는 방향 기준
  if (keysPressed['w']) {
    myAvatar.translateX(-moveDistance); // GLB 모델 기준 앞쪽이 -Z 또는 -X일 수 있음, 모델에 맞게 조정
    // 또는 myAvatar.translateZ(-moveDistance);
    moved = true;
  }
  if (keysPressed['s']) {
    myAvatar.translateX(moveDistance);
    // 또는 myAvatar.translateZ(moveDistance);
    moved = true;
  }

  // 간단한 경계 처리 (밖으로 못 나가게)
  const boundary = 9.5;
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));

  if (moved) {
    throttledUpdate(); // 상태 변경 시 RTDB 업데이트 (Throttled)
  }
};

// --- 다른 플레이어 부드러운 이동 처리 ---
const updateOtherPlayersMovement = (deltaTime) => {
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    const mesh = player.mesh;

    // 위치 보간 (Lerp)
    mesh.position.lerp(player.targetPosition, deltaTime * 5); // 숫자가 클수록 빠르게 따라감

    // 회전 보간 (Slerp, 좀 더 복잡하지만 여기서는 간단히 Lerp)
    // Quaternion을 사용하지 않고 Y축 회전만 Lerp (간단 버전)
    // 각도 차이를 계산하여 최단 경로로 회전하도록 보정 필요 (옵션)
    const angleDiff = THREE.MathUtils.lerp(mesh.rotation.y, player.targetRotationY, deltaTime * 5);
    mesh.rotation.y = angleDiff;
    // Quaternion slerp (더 부드러움, 나중에 구현)
    // const targetQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, player.targetRotationY, 0));
    // mesh.quaternion.slerp(targetQuaternion, deltaTime * 5);
  }
};


// --- 애니메이션 루프 ---
const animate = () => {
  if (!renderer) return; // 컴포넌트 파괴 시 중단
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // 내 아바타 이동 업데이트
  updatePlayerMovement(deltaTime);

  // 다른 아바타 이동 업데이트 (보간)
  updateOtherPlayersMovement(deltaTime);

  controls.update(); // OrbitControls 업데이트 (디버깅용)
  renderer.render(scene, camera);
};

// --- 창 크기 조절 처리 ---
const handleResize = () => {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

// --- 컴포넌트 라이프사이클 훅 ---
onMounted(async () => {
  if (!auth.currentUser) {
    // 로그인 안 되어 있으면 로딩 중단 또는 로그인 페이지로 리다이렉트
    isLoading.value = false;
    // router.push('/login'); // 필요 시 추가
    return;
  }
  const uid = auth.currentUser.uid;

  // 1. Three.js 초기화
  initThree();
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  animate(); // 애니메이션 루프 시작

  // 2. 내 정보 가져오기 (Firestore)
  loadingMessage.value = '내 정보 로딩 중...';
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      myAvatarUrl = userDoc.data().avatarUrl || '';
      myUserName = userDoc.data().name || '익명';
    } else {
      console.error("User document not found in Firestore!");
      // 에러 처리...
    }
  } catch (error) {
    console.error("Firestore에서 사용자 정보 가져오기 실패:", error);
    loadingMessage.value = '내 정보 로딩 실패.';
    return; // 로딩 중단
  }

  // 3. 내 아바타 로드 (Three.js)
  loadingMessage.value = '내 아바타 로딩 중...';
  try {
    myAvatar = await loadAvatar(myAvatarUrl);
    scene.add(myAvatar);
    // 초기 카메라가 아바타를 보도록 설정 (선택 사항)
    // controls.target.copy(myAvatar.position); controls.target.y += 1; // 타겟 높이 조정
  } catch (error) {
    loadingMessage.value = '아바타 로딩 실패.';
    // 기본 아바타 (Cube)가 로드되었을 수 있음
    if (!myAvatar) return; // Cube 로드도 실패하면 중단
  }

  // 4. RTDB 연결 및 다른 플레이어/채팅 리스닝 시작
  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza(); // isReady는 이 함수 내부에서 true로 설정됨
  listenToOtherPlayers();
  listenToChat();
  isLoading.value = false; // 모든 로딩 완료
});

onUnmounted(() => {
  // 이벤트 리스너 제거
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);

  // RTDB 리스너 제거
  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);

  // RTDB에서 내 정보 제거 (onDisconnect가 실패할 경우 대비)
  if (playerRef) remove(playerRef);

  // Three.js 리소스 정리
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  // Scene의 모든 자식 객체 정리 (Geometry, Material 등)
  if (scene) {
     scene.traverse(object => {
       if (object.geometry) object.geometry.dispose();
       if (object.material) {
         if (Array.isArray(object.material)) {
           object.material.forEach(m => m.dispose());
         } else {
           object.material.dispose();
         }
       }
     });
    scene = null;
  }
  camera = null;
  controls = null;
  clock = null;
  myAvatar = null;
  Object.keys(otherPlayers).forEach(key => delete otherPlayers[key]); // reactive 객체 정리
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
</style>