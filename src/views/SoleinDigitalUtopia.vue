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
const isReady = ref(false); // 모든 로딩 및 설정 완료 여부

// --- 아바타 관련 ---
let myAvatar = null; // 내 아바타 Three.js Object3D
const otherPlayers = reactive({}); // 다른 플레이어 정보 { userId: { mesh, targetPosition, targetRotationY } }
let myAvatarUrl = ''; // 내 아바타 GLB URL
let myUserName = ''; // 내 사용자 이름

// --- 채팅 관련 ---
const chatInput = ref('');
const chatMessages = ref([]); // { id: string, userName: string, message: string }
const messageListRef = ref(null); // 메시지 목록 DOM 참조
const MAX_CHAT_MESSAGES = 50; // 표시할 최대 메시지 수

// --- Three.js 관련 ---
let scene, camera, renderer, clock; // Scene, Camera, Renderer, Clock 인스턴스
const loader = new GLTFLoader(); // GLB 로더

// --- Firebase RTDB 경로 ---
const plazaPlayersPath = 'plazaPlayers'; // 플레이어 정보 경로
const plazaChatPath = 'plazaChat';       // 채팅 메시지 경로
let playerRef = null; // 내 RTDB 플레이어 데이터 참조
let playersListenerRef = null; // 다른 플레이어 리스너 참조
let chatListenerRef = null; // 채팅 리스너 참조

// --- 플레이어 이동 관련 ---
const moveSpeed = 2.0; // 이동 속도 증가 (초당 단위)
const rotateSpeed = Math.PI; // 회전 속도 증가 (초당 180도)
const keysPressed = reactive({}); // 현재 눌린 키 상태 (reactive로 변경하여 Vue가 감지하도록)
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 }); // 조이스틱 상태
let joystickManager = null; // 조이스틱 인스턴스

// --- Helper 함수: 아바타 로드 ---
const loadAvatar = (url) => {
  return new Promise((resolve, reject) => {
    if (!url || !url.endsWith('.glb')) { // URL 유효성 검사 강화
      console.warn("Avatar URL is invalid or not a GLB, using default cube.", url);
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.y = 0.5; // 바닥 위에 서도록
      resolve(cube);
      return;
    }
    loader.load(url,
      (gltf) => {
        const model = gltf.scene.clone(); // 독립적인 객체로 복제
        model.scale.set(0.7, 0.7, 0.7); // 크기 조절
        model.position.y = 0; // 바닥에 맞춤

        // 그림자 설정
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = false; // 바닥만 그림자 받도록 설정 (선택 사항)
          }
        });

        resolve(model);
      },
      undefined, // Progress 콜백
      (error) => {
        console.error('Avatar loading failed:', error, 'URL:', url);
        // 로딩 실패 시에도 기본 큐브 반환 (선택 사항)
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // 빨간색 큐브
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.5;
        resolve(cube); // 실패 시에도 Promise가 reject되지 않도록 resolve
        // reject(error); // 또는 실패를 명확히 하려면 reject
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
  // 현재 시간 이후의 메시지만 가져오도록 시작점 설정 (최초 로딩 시점 기준)
  const startTime = Date.now();
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));

  let initialDataLoaded = false; // 초기 데이터 로드 완료 플래그

  onChildAdded(chatListenerRef, (snapshot) => {
    const messageData = snapshot.val();

    // 초기 로드 시 너무 오래된 메시지(예: 1분 전)는 건너뛰기 (선택 사항)
    // if (!initialDataLoaded && messageData.timestamp < startTime - 60000) {
    //     return;
    // }
    initialDataLoaded = true; // 첫 메시지 수신 후 플래그 설정

    chatMessages.value.push({ id: snapshot.key, ...messageData });
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) {
      chatMessages.value.shift(); // 오래된 메시지 제거
    }
    // 새 메시지 수신 시 스크롤 맨 아래로
    nextTick(() => {
      if (messageListRef.value) {
        messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
      }
    });
  });
};

// --- Three.js 초기화 함수 ---
const initThree = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xade6ff); // 좀 더 밝은 하늘색
  scene.fog = new THREE.Fog(0xade6ff, 10, 30); // 안개 효과 추가 (원근감)

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 4); // 카메라 약간 뒤로 이동

  renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자

  // 조명 개선
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 주변광 약간 약하게
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); // 직사광 약간 강하게
  dirLight.position.set(5, 15, 10); // 조명 위치 조정
  dirLight.castShadow = true;
  // 그림자 품질 설정 (선택 사항)
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -15;
  dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 15;
  dirLight.shadow.camera.bottom = -15;
  scene.add(dirLight);
  // HemisphereLight 추가 (바닥면 자연스럽게)
  const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x99cc99, 0.5);
  scene.add(hemiLight);

  // 바닥 개선 (GridHelper 추가)
  const groundGeometry = new THREE.PlaneGeometry(30, 30); // 바닥 크기 증가
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x88bb88, side: THREE.DoubleSide }); // 약간 다른 녹색
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const gridHelper = new THREE.GridHelper(30, 30, 0xcccccc, 0xcccccc); // 그리드 추가
  scene.add(gridHelper);

  clock = new THREE.Clock();
};

// --- 플레이어 이동 로직 ---
const handleKeyDown = (event) => {
    // 채팅 입력 중에는 이동 키 무시
    if (document.activeElement === chatInput.value?.$el) return;
    keysPressed[event.key.toLowerCase()] = true;
};
const handleKeyUp = (event) => { keysPressed[event.key.toLowerCase()] = false; };
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

// 이동 및 회전 업데이트 로직 (PC+모바일 통합)
const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value) return;

  let moveDirection = new THREE.Vector3(0, 0, 0); // 이동 방향 벡터
  let targetRotationY = myAvatar.rotation.y;     // 목표 회전값
  let applyRotation = false;                     // 회전 적용 여부
  let applyMovement = false;                     // 이동 적용 여부
  let currentSpeedFactor = 1.0;                  // 속도 계수 (조이스틱 힘)

  // 조이스틱 입력 처리
  if (joystickData.value.active) {
    targetRotationY = -joystickData.value.angle + Math.PI / 2; // 목표 회전
    // 조이스틱 각도를 기반으로 이동 방향 벡터 계산 (-Z가 전방이라고 가정)
    moveDirection.z = -Math.cos(joystickData.value.angle); // NippleJS 각도 기준 정면
    moveDirection.x = -Math.sin(joystickData.value.angle); // NippleJS 각도 기준 오른쪽
    currentSpeedFactor = joystickData.value.force;         // 속도 조절
    applyRotation = true;
    applyMovement = joystickData.value.distance > 20; // 일정 거리 이상 움직였을 때만 이동
  }
  // 키보드 입력 처리
  else {
    // 회전 (A, D, ArrowLeft, ArrowRight)
    if (keysPressed['a'] || keysPressed['arrowleft']) {
      targetRotationY += rotateSpeed * deltaTime;
      applyRotation = true;
    }
    if (keysPressed['d'] || keysPressed['arrowright']) {
      targetRotationY -= rotateSpeed * deltaTime;
      applyRotation = true;
    }
    // 이동 (W, S, ArrowUp, ArrowDown) -Z 방향 기준
    if (keysPressed['w'] || keysPressed['arrowup']) {
      moveDirection.z = -1;
      applyMovement = true;
    }
    if (keysPressed['s'] || keysPressed['arrowdown']) {
      moveDirection.z = 1;
      applyMovement = true;
    }
  }

  // 회전 적용 (부드럽게 Lerp + 최단 각도)
  if (applyRotation) {
    let currentY = myAvatar.rotation.y;
    const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2;
    targetRotationY = (targetRotationY % PI2 + PI2) % PI2;
    let diff = targetRotationY - currentY;
    if (Math.abs(diff) > Math.PI) {
      diff = diff > 0 ? diff - PI2 : diff + PI2;
    }
    myAvatar.rotation.y += diff * deltaTime * 8; // 회전 보간 속도 (조절 가능)
  }

  // 이동 적용
  if (applyMovement) {
    // 이동 방향을 현재 아바타의 회전에 맞게 변환
    const moveVector = moveDirection.clone().multiplyScalar(moveSpeed * currentSpeedFactor * deltaTime);
    // 키보드는 정면/후면만 있으므로 회전 적용 불필요 / 조이스틱은 이미 각도 반영됨
    // moveVector.applyEuler(myAvatar.rotation); // <- 키보드 좌우 이동 추가 시 필요

    // 현재 회전 방향으로 이동 (translateZ 사용)
    // 조이스틱의 경우 이미 방향 벡터가 계산되었으므로 직접 더함
    if (joystickData.value.active) {
        // 이동 벡터를 월드 좌표 기준으로 회전하지 않고, 아바타 로컬 Z축으로 이동
        // 조이스틱의 힘(currentSpeedFactor) 반영
        myAvatar.translateZ(moveDirection.z * moveSpeed * currentSpeedFactor * deltaTime);
    } else {
        // 키보드는 단순 전후 이동만 처리
         myAvatar.translateZ(moveDirection.z * moveSpeed * deltaTime);
    }


    moved = true; // 이동했음을 표시
  }


  // 경계 처리
  const boundary = 14.5; // 바닥 크기에 맞춤
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  // Y축 강제 고정 (점프 등 방지)
  myAvatar.position.y = 0;


  if (moved || applyRotation) { // 이동 또는 회전이 발생했을 때만 RTDB 업데이트
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
  if (!renderer) return; // 컴포넌트 unmount 시 중단
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);

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
    console.error("User not logged in.");
    loadingMessage.value = "로그인이 필요합니다.";
    isLoading.value = false; // 로딩 중단
    // 여기에 로그인 페이지로 리다이렉트하는 로직 추가 가능
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
      myUserName = '익명'; // 이름이라도 기본값 설정
      // 에러 처리...
    }
  } catch (error) {
    console.error("Firestore에서 사용자 정보 가져오기 실패:", error);
    loadingMessage.value = '내 정보 로딩 실패.';
    // isLoading.value = false; // 에러 발생 시 로딩 중단 고려
    return;
  }

  // 3. 내 아바타 로드 (Three.js)
  loadingMessage.value = '내 아바타 로딩 중...';
  try {
    myAvatar = await loadAvatar(myAvatarUrl);
    scene.add(myAvatar);
    // 카메라가 아바타 뒤를 따라다니도록 설정 (간단 버전)
    camera.lookAt(myAvatar.position); // 초기 시점
  } catch (error) {
    // loadAvatar 내부에서 이미 에러 처리 및 기본 큐브 반환
    loadingMessage.value = '아바타 로딩 중 오류 발생. 기본 아바타로 시작합니다.';
    if (!myAvatar) { // 기본 큐브 로드도 실패한 경우
        isLoading.value = false; // 로딩 중단
        return;
    }
     scene.add(myAvatar); // 기본 큐브라도 추가
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
  } else {
    console.warn("Joystick zone element not found.");
  }

  // 5. RTDB 연결 및 다른 플레이어/채팅 리스닝 시작
  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza(); // isReady는 이 함수 내부에서 true로 설정됨
  if(isReady.value){ // joinPlaza 성공 시에만 리스너 시작
      listenToOtherPlayers();
      listenToChat();
  }
  isLoading.value = false; // 모든 로딩 완료 (또는 joinPlaza 실패 시 이미 true)
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