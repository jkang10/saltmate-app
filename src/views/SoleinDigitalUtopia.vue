<template>
  <div class="utopia-container">
    <canvas ref="canvasRef" class="main-canvas"></canvas>

    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <p>{{ loadingMessage }}</p>
    </div>

    <div id="joystick-zone" class="joystick-zone"></div>

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
import { auth, db, rtdb } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import {
  ref as dbRef, onChildAdded, onChildChanged, onChildRemoved,
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove
} from 'firebase/database';
import nipplejs from 'nipplejs';

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
let scene, camera, renderer, clock;
const loader = new GLTFLoader();

// --- Firebase RTDB 경로 ---
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
let playerRef = null;
let playersListenerRef = null;
let chatListenerRef = null;

// --- 플레이어 이동 관련 ---
const moveSpeed = 2.0;
const rotateSpeed = Math.PI;
const keysPressed = reactive({});
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 });
let joystickManager = null;

// --- Helper 함수: 아바타 로드 ---
const loadAvatar = (url) => {
  return new Promise((resolve) => { // reject 제거
    if (!url || !url.endsWith('.glb')) {
      console.warn("Avatar URL is invalid or not a GLB, using default cube.", url);
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.y = 0.5;
      resolve(cube);
      return;
    }
    loader.load(url,
      (gltf) => {
        const model = gltf.scene.clone();
        model.scale.set(0.7, 0.7, 0.7);
        model.position.y = 0;
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = false;
          }
        });
        resolve(model);
      },
      undefined,
      (error) => {
        console.error('Avatar loading failed:', error, 'URL:', url);
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // 로딩 실패 시 빨간 큐브
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.5;
        resolve(cube); // 실패 시에도 기본 큐브 resolve
      }
    );
  });
};

// --- Firebase RTDB 함수 ---
// Plaza 입장 시 내 정보 RTDB에 등록
const joinPlaza = async () => {
  if (!auth.currentUser || !myAvatar) {
      console.error("Cannot join plaza: User not logged in or avatar not loaded.");
      return;
  }
  const uid = auth.currentUser.uid;
  playerRef = dbRef(rtdb, `${plazaPlayersPath}/${uid}`);

  const playerData = {
    avatarUrl: myAvatarUrl,
    userName: myUserName,
    position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(),
  };

  try {
    await set(playerRef, playerData);
    await onDisconnect(playerRef).remove(); // 연결 해제 시 자동 삭제
    console.log('Plaza joined successfully');
    isReady.value = true; // 이동 및 채팅 활성화
  } catch (error) {
    console.error("Failed to join Plaza:", error);
    isLoading.value = true;
    loadingMessage.value = "입장에 실패했습니다.";
  }
};

// 내 상태 RTDB에 업데이트 (위치, 회전)
const updateMyStateInRTDB = () => {
  if (!playerRef || !myAvatar || !isReady.value) return;

  const newState = {
    position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(),
  };
  // RTDB 업데이트 (다른 정보는 유지)
  set(playerRef, { ...newState, avatarUrl: myAvatarUrl, userName: myUserName });
};

// Throttling: 지정된 간격(updateInterval)마다 한 번만 업데이트 실행
let lastUpdateTime = 0;
const updateInterval = 100; // 100ms (1초에 10번)

const throttledUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    updateMyStateInRTDB();
    lastUpdateTime = now;
  }
};

// 다른 플레이어 입장/상태변경/퇴장 감지
const listenToOtherPlayers = () => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  const uid = auth.currentUser.uid;

  // 플레이어 입장
  onChildAdded(playersListenerRef, async (snapshot) => {
    const userId = snapshot.key;
    if (userId === uid || otherPlayers[userId]) return; // 본인 또는 이미 로드된 플레이어 제외

    loadingMessage.value = `플레이어 ${snapshot.val().userName || userId} 로딩 중...`;
    isLoading.value = true; // 로딩 시작 표시 (선택 사항)

    const playerData = snapshot.val();
    try {
      const avatarMesh = await loadAvatar(playerData.avatarUrl);
      scene.add(avatarMesh);
      avatarMesh.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
      avatarMesh.rotation.y = playerData.rotationY;

      otherPlayers[userId] = {
        mesh: avatarMesh,
        targetPosition: new THREE.Vector3().copy(avatarMesh.position),
        targetRotationY: avatarMesh.rotation.y,
      };
      console.log(`${playerData.userName || userId} joined`);
    } catch (error) {
      console.error(`Failed to load avatar for player ${userId}:`, error);
    } finally {
      // 모든 플레이어 로딩 후 로딩 상태 해제 (개선 필요: 개별 로딩 상태 관리)
      isLoading.value = false;
    }
  });

  // 플레이어 상태 변경 (위치/회전 업데이트 수신)
  onChildChanged(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === uid || !otherPlayers[userId]) return;

    const playerData = snapshot.val();
    const player = otherPlayers[userId];

    // 목표 위치/회전 업데이트 (애니메이션 루프에서 부드럽게 이동)
    player.targetPosition.set(playerData.position.x, playerData.position.y, playerData.position.z);
    player.targetRotationY = playerData.rotationY;
  });

  // 플레이어 퇴장
  onChildRemoved(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === uid || !otherPlayers[userId]) return;

    const playerToRemove = otherPlayers[userId];
    scene.remove(playerToRemove.mesh);

    // Three.js 메모리 정리
    if (playerToRemove.mesh.geometry) playerToRemove.mesh.geometry.dispose();
    if (playerToRemove.mesh.material) {
      if (Array.isArray(playerToRemove.mesh.material)) {
        playerToRemove.mesh.material.forEach(m => m.dispose());
      } else {
        playerToRemove.mesh.material.dispose();
      }
    }
    // 모델 자식들의 리소스도 정리 (필요 시)
    playerToRemove.mesh.traverse(child => {
       if (child.isMesh) {
           child.geometry.dispose();
           if(child.material.map) child.material.map.dispose();
           // ... 다른 텍스처 map들 dispose
           child.material.dispose();
       }
    });


    delete otherPlayers[userId];
    console.log(`Player ${userId} left`);
  });
};

// --- 채팅 함수 ---
// 메시지 전송
const sendMessage = () => {
  if (!chatInput.value.trim() || !isReady.value || !auth.currentUser) return;

  const chatMessage = {
    userId: auth.currentUser.uid,
    userName: myUserName || '익명',
    message: chatInput.value.trim(),
    timestamp: serverTimestamp(),
  };

  push(dbRef(rtdb, plazaChatPath), chatMessage);
  chatInput.value = ''; // 입력 필드 초기화
};

// 새 메시지 수신
const listenToChat = () => {
  // [수정 2, 3] startTime, initialDataLoaded 변수 제거
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));

  onChildAdded(chatListenerRef, (snapshot) => {
    // const messageData = snapshot.val(); // 필요 시 사용 가능

    chatMessages.value.push({ id: snapshot.key, ...snapshot.val() });
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) {
      chatMessages.value.shift();
    }
    nextTick(() => {
      if (messageListRef.value) {
        messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
      }
    });
  });
};


// --- Three.js 초기화 함수 ---
const initThree = () => {
  scene = new THREE.Scene(); // scene 초기화 확인
  scene.background = new THREE.Color(0xade6ff);
  scene.fog = new THREE.Fog(0xade6ff, 10, 30);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 4);

  // canvasRef.value가 확실히 존재할 때 renderer 생성
  if (canvasRef.value) {
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } else {
      console.error("Canvas element not found for renderer initialization!");
      return; // 렌더러 생성 실패 시 중단
  }

  // 조명
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 15, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -15;
  dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 15;
  dirLight.shadow.camera.bottom = -15;
  scene.add(dirLight);
  const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x99cc99, 0.5);
  scene.add(hemiLight);

  // 바닥
  const groundGeometry = new THREE.PlaneGeometry(30, 30);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x88bb88, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const gridHelper = new THREE.GridHelper(30, 30, 0xcccccc, 0xcccccc);
  scene.add(gridHelper);

  clock = new THREE.Clock(); // clock 초기화 확인
};

// --- 플레이어 이동 로직 ---
const handleKeyDown = (event) => {
    if (document.activeElement === chatInput.value?.$el) return;
    keysPressed[event.key.toLowerCase()] = true;
};
const handleKeyUp = (event) => { keysPressed[event.key.toLowerCase()] = false; };
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value) return;

  let moved = false; // moved 변수 선언 확인
  let moveDirection = new THREE.Vector3(0, 0, 0);
  let targetRotationY = myAvatar.rotation.y;
  let applyRotation = false;
  let applyMovement = false;
  let currentSpeedFactor = 1.0;2025-10-25

  // 조이스틱 입력 처리
  if (joystickData.value.active) {
    targetRotationY = -joystickData.value.angle + Math.PI / 2;
    moveDirection.z = -Math.cos(joystickData.value.angle);
    moveDirection.x = -Math.sin(joystickData.value.angle);
    currentSpeedFactor = joystickData.value.force;
    applyRotation = true;
    applyMovement = joystickData.value.distance > 20;
  }
  // 키보드 입력 처리
  else {
    if (keysPressed['a'] || keysPressed['arrowleft']) {
      targetRotationY += rotateSpeed * deltaTime;
      applyRotation = true;
    }
    if (keysPressed['d'] || keysPressed['arrowright']) {
      targetRotationY -= rotateSpeed * deltaTime;
      applyRotation = true;
    }
    if (keysPressed['w'] || keysPressed['arrowup']) {
      moveDirection.z = -1;
      applyMovement = true;
    }
    if (keysPressed['s'] || keysPressed['arrowdown']) {
      moveDirection.z = 1;
      applyMovement = true;
    }
  }

  // 회전 적용
  if (applyRotation) {
    let currentY = myAvatar.rotation.y;
    const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2;
    targetRotationY = (targetRotationY % PI2 + PI2) % PI2;
    let diff = targetRotationY - currentY;
    if (Math.abs(diff) > Math.PI) {
      diff = diff > 0 ? diff - PI2 : diff + PI2;
    }
    myAvatar.rotation.y += diff * deltaTime * 8;
  }

  // 이동 적용
  if (applyMovement) {
    // [수정 4] moveVector 변수 제거
    // const moveVector = moveDirection.clone().multiplyScalar(moveSpeed * currentSpeedFactor * deltaTime);

// 이동 적용
  if (applyMovement) {
    // moveVector 변수 제거됨
    if (joystickData.value.active) {
        myAvatar.translateZ(moveDirection.z * moveSpeed * currentSpeedFactor * deltaTime);
    } else {
         myAvatar.translateZ(moveDirection.z * moveSpeed * deltaTime);
    }
    moved = true; // moved 변수 사용 확인
  }

  // 경계 처리
  const boundary = 14.5;
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  myAvatar.position.y = 0;

  // moved 변수 사용 확인
  if (moved || applyRotation) {
    throttledUpdate();
  }
};

// --- 다른 플레이어 부드러운 이동 처리 ---
const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8; // 다른 플레이어 따라가는 속도 증가
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    const mesh = player.mesh;

    // 위치 보간 (Lerp)
    mesh.position.lerp(player.targetPosition, lerpFactor);

    // 회전 보간 (Y축만 Lerp + 최단 각도)
    let currentY = mesh.rotation.y;
    let targetY = player.targetRotationY;
    const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2;
    targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY;
    if (Math.abs(diff) > Math.PI) {
      diff = diff > 0 ? diff - PI2 : diff + PI2;
    }
    mesh.rotation.y += diff * lerpFactor;
    // Y축 이외 회전 강제 초기화 (모델 기울어짐 방지)
    mesh.rotation.x = 0;
    mesh.rotation.z = 0;
  }
};

// --- 애니메이션 루프 ---
const animate = () => {
  // renderer가 unmounted 시 null이 될 수 있으므로 체크
  if (!renderer || !scene || !camera || !clock) return;
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);

  // 카메라가 내 아바타를 따라다니도록 (간단한 버전)
  if (myAvatar) {
      const offset = new THREE.Vector3(0, 2, 4); // 아바타 뒤쪽 상단 오프셋
      offset.applyQuaternion(myAvatar.quaternion); // 아바타 회전에 따라 오프셋 방향 변경
      camera.position.lerp(myAvatar.position.clone().add(offset), deltaTime * 2.0); // 부드럽게 따라감
      camera.lookAt(myAvatar.position.clone().add(new THREE.Vector3(0, 1, 0))); // 아바타 약간 위쪽 바라봄
  }

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
  // [수정] 실행 순서 보장
  if (!auth.currentUser) {
    console.error("User not logged in.");
    loadingMessage.value = "로그인이 필요합니다.";
    isLoading.value = false;
    return;
  }
  const uid = auth.currentUser.uid;

  // 1. Three.js 환경 초기화 (scene 객체 생성 보장)
  initThree();
  if (!scene || !renderer || !clock) { // 초기화 실패 시 중단
      loadingMessage.value = "3D 환경 초기화 실패.";
      isLoading.value = false;
      return;
  }

  // 이벤트 리스너 등록
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  animate(); // 애니메이션 루프 시작

  // 2. 내 정보 가져오기 (Firestore) - 비동기
  loadingMessage.value = '내 정보 로딩 중...';
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      myAvatarUrl = userDoc.data().avatarUrl || '';
      myUserName = userDoc.data().name || '익명';
    } else {
      console.error("User document not found in Firestore!");
      myUserName = '익명';
    }
  } catch (error) {
    console.error("Firestore에서 사용자 정보 가져오기 실패:", error);
    loadingMessage.value = '내 정보 로딩 실패.';
    isLoading.value = false; // 로딩 중단
    return;
  }

  // 3. 내 아바타 로드 (Three.js) - 비동기
  loadingMessage.value = '내 아바타 로딩 중...';
  try {
    myAvatar = await loadAvatar(myAvatarUrl);
    // [수정] scene이 확실히 존재할 때 add 호출
    scene.add(myAvatar);
    camera.lookAt(myAvatar.position);
  } catch (error) {
    // loadAvatar에서 실패 시 기본 큐브 resolve하도록 수정했으므로, 여기서 에러 처리 불필요
    loadingMessage.value = '아바타 로딩 중 오류 발생. 기본 아바타로 시작합니다.';
    // 에러 발생 시 로드된 기본 큐브(myAvatar)라도 씬에 추가
    if (myAvatar) {
        scene.add(myAvatar);
    } else {
        // 기본 큐브 로드도 실패한 극단적인 경우
        console.error("Failed to load even the default avatar.");
        isLoading.value = false;
        return;
    }
  }

   // 4. 조이스틱 초기화
const joystickZone = document.getElementById('joystick-zone');
  if (joystickZone) {
    try {
        joystickManager = nipplejs.create({
          zone: joystickZone,
          mode: 'static',
          position: { right: '80px', bottom: '80px' }, // 오른쪽 하단
          color: 'rgba(255, 255, 255, 0.5)',
          size: 100
        });
        joystickManager.on('move', handleJoystickMove);
        joystickManager.on('end', handleJoystickEnd);
    } catch (e) {
        console.error("Failed to create joystick:", e);
        // 조이스틱 생성 실패 시 사용자에게 알림 등 처리 가능
    }
else { console.warn("Joystick zone element not found."); }

  // 5. RTDB 연결 및 리스너 시작 - 비동기
  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza();
  if(isReady.value){
      listenToOtherPlayers();
      listenToChat();
  } else {
      // joinPlaza 실패 시 로딩 메시지 유지 또는 다른 처리
      loadingMessage.value = 'Plaza 연결 실패.';
      // isLoading.value = false; // 로딩은 멈출 수 있음
      return;
  }
  isLoading.value = false; // 모든 비동기 작업 완료 후 로딩 해제
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

  // 조이스틱 제거
  if (joystickManager) {
    joystickManager.off('move', handleJoystickMove);
    joystickManager.off('end', handleJoystickEnd);
    joystickManager.destroy();
    joystickManager = null;
  }

  // Three.js 리소스 정리
  if (renderer) { renderer.dispose(); renderer = null; }
  if (scene) {
     scene.traverse(object => {
       if(!object.isMesh) return;
       if (object.geometry) object.geometry.dispose();
       if (object.material) {
         if (Array.isArray(object.material)) {
           object.material.forEach(m => {
               if(m.map) m.map.dispose();
               // ... other maps
               m.dispose();
           });
         } else {
           if(object.material.map) object.material.map.dispose();
           // ... other maps
           object.material.dispose();
         }
       }
     });
    scene = null;
  }
  camera = null; clock = null; myAvatar = null;
  Object.keys(otherPlayers).forEach(key => delete otherPlayers[key]);
});

</script>

<style scoped>
.utopia-container {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
}
.main-canvas { display: block; }
.loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; }
.spinner { border: 4px solid rgba(255, 255, 255, 0.3); width: 36px; height: 36px; border-radius: 50%; border-left-color: #fff; animation: spin 1s ease infinite; margin-bottom: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.chat-ui { position: absolute; bottom: 20px; left: 20px; width: 300px; max-height: 40%; background-color: rgba(0, 0, 0, 0.6); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; z-index: 5; }
.message-list { flex-grow: 1; overflow-y: auto; margin-bottom: 10px; color: white; font-size: 0.9em; }
.chat-message { margin-bottom: 5px; word-break: break-all; }
.chat-message strong { color: #f1c40f; }
.chat-ui input { width: 100%; padding: 8px; border: none; border-radius: 4px; background-color: rgba(255, 255, 255, 0.2); color: white; outline: none; }
.chat-ui input:disabled { background-color: rgba(255, 255, 255, 0.1); cursor: not-allowed; }
.joystick-zone { position: absolute; bottom: 30px; right: 30px; /* 오른쪽 하단으로 이동 */ width: 150px; height: 150px; z-index: 6; }
</style>