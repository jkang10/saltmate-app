<template>
  <div class="utopia-container">
    <canvas ref="canvasRef" class="main-canvas" tabindex="0"></canvas>

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
        ref="chatInputRef" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// [수정] OrbitControls import
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { auth, db, rtdb } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import {
  ref as dbRef, onChildAdded, onChildChanged, onChildRemoved,
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove,
  update
} from 'firebase/database';
// eslint-disable-next-line no-unused-vars
import nipplejs from 'nipplejs';

// --- 유틸리티 함수 ---
const isFiniteNumber = (num) => (typeof num === 'number' && isFinite(num));

// --- 상태 변수 ---
const canvasRef = ref(null);
const isLoading = ref(true);
const loadingMessage = ref('유토피아 입장 준비 중...');
const isReady = ref(false);

// --- 아바타 관련 ---
let myAvatar = null;
let otherPlayers = {};
let myAvatarUrl = '';
let myUserName = '';

// --- 채팅 관련 ---
const chatInput = ref('');
const chatMessages = ref([]);
const messageListRef = ref(null);
const chatInputRef = ref(null);
const MAX_CHAT_MESSAGES = 50;

// --- Three.js 관련 ---
let scene, camera, renderer, clock;
let controls; // OrbitControls 인스턴스
// [삭제] 클릭 이동 관련 변수 모두 삭제
const loader = new GLTFLoader();

// --- Firebase RTDB 경로 ---
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
let playerRef = null;
let playersListenerRef = null;
let chatListenerRef = null;

// --- 플레이어 이동 관련 ---
const moveSpeed = 2.0;
// [삭제] rotateSpeed 변수 삭제
const keysPressed = reactive({});
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 });
let joystickManager = null;

// --- [수정] 헬퍼 함수: 애니메이션 파일 로드 (좌우/뒤 추가) ---
const loadAnimations = async () => {
  const animationPaths = {
    idle: '/animations/M_Standing_Idle_Variations_008.glb',
    walk: '/animations/F_Walk_003.glb',
    walkBackward: '/animations/M_Walk_Backwards_001.glb', // 뒤로 걷기
    strafeLeft: '/animations/M_Walk_Strafe_Left_002.glb',  // 왼쪽 게걸음
    strafeRight: '/animations/M_Walk_Strafe_Right_002.glb' // 오른쪽 게걸음
  };
  const loadedAnimations = { idle: null, walk: null, walkBackward: null, strafeLeft: null, strafeRight: null };
  const keys = Object.keys(animationPaths);

  try {
    const gltfResults = await Promise.all(
      Object.values(animationPaths).map(path => loader.loadAsync(path).catch(e => {
        console.error(`애니메이션 로드 실패: ${path}`, e);
        return null;
      }))
    );

    gltfResults.forEach((gltf, index) => {
      const key = keys[index];
      if (gltf && gltf.animations && gltf.animations.length > 0) {
        loadedAnimations[key] = gltf.animations[0];
        console.log(`${key} 애니메이션 클립 로드 성공:`, loadedAnimations[key].name);
      } else if (gltf) {
        console.error(`${key} 애니메이션 파일에 클립이 없습니다:`, animationPaths[key]);
      }
    });

    return loadedAnimations;

  } catch (error) {
    console.error('애니메이션 로딩 중 전체 오류 발생:', error);
    return loadedAnimations;
  }
};

// --- [수정] 헬퍼 함수: 아바타 로드 (닉네임 지연 문제 해결) ---
const loadAvatar = (url, animations) => {
  return new Promise((resolve) => {
    const model = new THREE.Group();
    // ▼▼▼ [수정] 닉네임 지연 문제 해결 (부모 matrixAutoUpdate = true) ▼▼▼
    model.matrixAutoUpdate = true;
    // ▲▲▲
    model.position.set(0, 0, 0);
    model.userData.mixer = null;
    model.userData.actions = {};

    // URL 없거나 GLB 아닐 때 기본 큐브 생성
    if (!url || !url.endsWith('.glb')) {
      console.warn("아바타 URL이 유효하지 않거나 GLB 파일이 아닙니다. 기본 큐브를 사용합니다.", url);
      const visuals = new THREE.Group();
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // 기본 큐브 색상 (녹색)
      const cube = new THREE.Mesh(geometry, material);
      cube.position.y = 0.5;
      visuals.add(cube);
      visuals.scale.set(0.7, 0.7, 0.7);
      model.add(visuals);
      resolve(model);
      return;
    }

    loader.load(url,
      (gltf) => {
        const visuals = gltf.scene;
        const box = new THREE.Box3().setFromObject(visuals);
        const center = box.getCenter(new THREE.Vector3());

        visuals.traverse((child) => {
          if (child.isSkinnedMesh) {
            child.geometry.translate(-center.x, -box.min.y, -center.z);
            child.castShadow = true;
            child.matrixAutoUpdate = false; // 스킨 메쉬는 false 권장
          }
          else if (child.isMesh) {
            child.geometry.translate(-center.x, -box.min.y, -center.z);
            child.castShadow = true;
            child.matrixAutoUpdate = true;
          }
        });

        visuals.scale.set(0.7, 0.7, 0.7);
        visuals.position.set(0, 0, 0);
        visuals.rotation.set(0, 0, 0);
        visuals.matrixAutoUpdate = true;
        model.add(visuals);

        // 닉네임 부착을 위해 visuals 그룹을 userData에 저장
        model.userData.visuals = visuals;

        // --- [수정] 애니메이션 적용 로직 (로드된 모든 애니메이션) ---
        if (animations && Object.values(animations).some(clip => clip !== null)) {
          const mixer = new THREE.AnimationMixer(visuals);
          model.userData.mixer = mixer;

          for (const key in animations) {
            if (animations[key]) {
              const action = mixer.clipAction(animations[key]);
              model.userData.actions[key] = action;
              if (key === 'idle') {
                action.play();
              }
            } else {
              console.warn(`[${url}] '${key}' 애니메이션 클립이 로드되지 않아 적용할 수 없습니다.`);
            }
          }
           console.log(`[${url}] 로드된 외부 애니메이션 적용 완료`, Object.keys(model.userData.actions));
        } else {
          console.warn(`[${url}] 미리 로드된 애니메이션 클립이 하나도 없습니다.`);
        }
        // --- 애니메이션 적용 로직 끝 ---

        resolve(model);
      },
      undefined,
      (error) => {
        console.error('아바타 로딩 실패:', error, 'URL:', url);
        // ★★★ 빨간색 큐브로 변경 ★★★
        const visuals = new THREE.Group();
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // 빨간색
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.5;
        visuals.add(cube);
        visuals.scale.set(0.7, 0.7, 0.7);
        model.add(visuals);
        resolve(model);
      }
    );
  });
};

// --- [수정] 헬퍼 함수: 닉네임 스프라이트 생성 (닉네임 지연 문제) ---
const createNicknameSprite = (text) => {
  const resolutionScale = 2;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 24 * resolutionScale;
  const fontWeight = 'bold';
  const fontFamily = 'Arial';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const textMetrics = context.measureText(text);
  const textWidth = textMetrics.width;
  const padding = 10 * resolutionScale;
  const verticalPadding = 5 * resolutionScale;
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + verticalPadding * 2;
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  const radius = 8 * resolutionScale;
  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(canvas.width - radius, 0);
  context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  context.lineTo(canvas.width, canvas.height - radius);
  context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
  context.lineTo(radius, canvas.height);
  context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fill();
  context.fillStyle = 'white';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const scale = 0.0025;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1.0);
  sprite.position.y = 1.5;

  // ▼▼▼ [수정] matrixAutoUpdate 라인 삭제 (닉네임이 먼저 가는 현상 수정) ▼▼▼
  // sprite.matrixAutoUpdate = true;
  // ▲▲▲ 수정 완료 ▲▲▲

  return sprite;
};

// --- 헬퍼 함수: 채팅 말풍선 스프라이트 생성 ---
const createChatBubbleSprite = (text) => {
  const resolutionScale = 2;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 20 * resolutionScale;
  const fontWeight = 'normal';
  const fontFamily = 'Arial';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const maxWidth = 300 * resolutionScale;
  const textMetrics = context.measureText(text);
  const textWidth = Math.min(textMetrics.width, maxWidth);
  const padding = 10 * resolutionScale;
  const verticalPadding = 5 * resolutionScale;
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + verticalPadding * 2;
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  context.lineWidth = 2 * resolutionScale;
  const radius = 8 * resolutionScale;
  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(canvas.width - radius, 0);
  context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  context.lineTo(canvas.width, canvas.height - radius);
  context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
  context.lineTo(radius, canvas.height);
  context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = 'black';
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  const scale = 0.0025;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1.0);
  sprite.position.y = 1.9;
  return sprite;
};

// --- 헬퍼 함수: 아바타에 말풍선 표시 (5초 후 자동 제거) ---
const showChatBubble = (avatar, message) => {
  if (!avatar) return;
  if (avatar.activeBubble) {
    avatar.remove(avatar.activeBubble);
    avatar.activeBubble.material.map.dispose();
    avatar.activeBubble.material.dispose();
    clearTimeout(avatar.activeBubble.timeoutId);
    avatar.activeBubble = null;
  }
  const newBubble = createChatBubbleSprite(message);
  const timeoutId = setTimeout(() => {
    if (avatar.activeBubble === newBubble) {
      avatar.remove(newBubble);
      newBubble.material.map.dispose();
      newBubble.material.dispose();
      avatar.activeBubble = null;
    }
  }, 5000);
  newBubble.timeoutId = timeoutId;
  avatar.activeBubble = newBubble;
  avatar.add(newBubble);
};

// --- [삭제] 클릭/터치 이동 관련 함수 (handlePointerDown, handlePointerUp) ---
// (해당 함수 정의 전체 삭제)

// --- Firebase RTDB 관련 함수 ---
const joinPlaza = async () => {
  if (!auth.currentUser || !myAvatar) {
      console.error("Plaza에 참여할 수 없습니다: 로그인되지 않았거나 아바타가 로드되지 않았습니다.");
      return;
  }
  const currentUid = auth.currentUser.uid;
  playerRef = dbRef(rtdb, `${plazaPlayersPath}/${currentUid}`);
  const playerData = {
    avatarUrl: myAvatarUrl,
    userName: myUserName,
    position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(),
  };
  try {
    await set(playerRef, playerData);
    await onDisconnect(playerRef).remove();
    console.log('Plaza 입장에 성공했습니다.');
    isReady.value = true;
  } catch (error) {
    console.error("Plaza 입장 실패:", error);
    isLoading.value = true;
    loadingMessage.value = "입장에 실패했습니다.";
  }
};

const updateMyStateInRTDB = () => {
  if (!playerRef || !myAvatar || !isReady.value) return;
  const { x, y, z } = myAvatar.position;
  const currentRotationY = myAvatar.rotation.y;
  const newState = {
    position: {
      x: isFiniteNumber(x) ? x : 0,
      y: isFiniteNumber(y) ? y : 0,
      z: isFiniteNumber(z) ? z : 0,
    },
    rotationY: isFiniteNumber(currentRotationY) ? currentRotationY : 0,
    timestamp: serverTimestamp(),
  };
  update(playerRef, newState)
    .catch((error) => {
      if (isReady.value) {
        console.error("!!! RTDB UPDATE FAILED (DB 규칙 확인 필요) !!!", error.message);
        isReady.value = false;
        isLoading.value = true;
        loadingMessage.value = `실시간 연결 끊김: ${error.message}`;
      }
    });
};

let lastUpdateTime = 0;
const updateInterval = 100;
const throttledUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    updateMyStateInRTDB();
    lastUpdateTime = now;
  }
};

// --- [수정] listenToOtherPlayers (닉네임 부착 위치 수정) ---
const listenToOtherPlayers = (preloadedAnimations) => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  const currentUid = auth.currentUser.uid;

  onChildAdded(playersListenerRef, async (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || otherPlayers[userId]) return;
    const playerData = snapshot.val();
    console.log(`플레이어 입장 감지: ${playerData.userName || userId}`);
    otherPlayers[userId] = {
      mesh: null, mixer: null, actions: {},
      targetPosition: new THREE.Vector3(playerData.position?.x ?? 0, playerData.position?.y ?? 0, playerData.position?.z ?? 0),
      targetRotationY: playerData.rotationY ?? 0,
      userName: playerData.userName || '익명',
      isMoving: false
    };
    try {
      const loadedModel = await loadAvatar(playerData.avatarUrl, preloadedAnimations);
      console.log(`${playerData.userName || userId} 아바타 로드 완료 (애니메이션 포함)`);
      if (scene && otherPlayers[userId]) {
          loadedModel.position.copy(otherPlayers[userId].targetPosition);
          loadedModel.rotation.y = otherPlayers[userId].targetRotationY;
          if (otherPlayers[userId].userName !== '익명') {
              const otherNickname = createNicknameSprite(otherPlayers[userId].userName);
              
              // ▼▼▼ [수정] 닉네임을 visuals 그룹에 추가 (닉네임 지연 문제) ▼▼▼
              if (loadedModel.userData.visuals) {
                  loadedModel.userData.visuals.add(otherNickname);
              } else {
                  loadedModel.add(otherNickname); // 비상시
              }
              // ▲▲▲ 수정 완료 ▲▲▲
          }
          scene.add(loadedModel);
          otherPlayers[userId].mesh = loadedModel;
          otherPlayers[userId].mixer = loadedModel.userData.mixer;
          otherPlayers[userId].actions = loadedModel.userData.actions;
          console.log(`${playerData.userName || userId} 씬에 추가 완료 (애니메이션 설정 포함)`);
      } else {
          if (otherPlayers[userId]) { delete otherPlayers[userId]; }
      }
    } catch (error) {
      console.error(`${userId} 플레이어 처리 중 오류 발생:`, error);
      if (otherPlayers[userId]) { delete otherPlayers[userId]; }
    }
  });

  onChildChanged(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return;
    const playerData = snapshot.val();
    const player = otherPlayers[userId];
    if (!playerData || !playerData.position) {
        console.warn(`[onChildChanged] ${userId}의 playerData 또는 position이 null입니다.`, playerData);
        return;
    }
    const newRotationY = playerData.rotationY;
    if (isFiniteNumber(newRotationY)) {
        player.targetRotationY = newRotationY;
    }
    player.targetPosition.set(playerData.position.x ?? 0, playerData.position.y ?? 0, playerData.position.z ?? 0);
  });

  onChildRemoved(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return;
    const playerToRemove = otherPlayers[userId];
    // ... (말풍선 정리) ...
    if (scene && playerToRemove.mesh) { scene.remove(playerToRemove.mesh); }
    if (playerToRemove.mesh) {
        playerToRemove.mesh.traverse(child => {
           // ... (리소스 정리) ...
        });
    }
    delete otherPlayers[userId];
    console.log(`플레이어 ${userId} 퇴장`);
  });
};

const listenToChat = () => {
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));
  onChildAdded(chatListenerRef, (snapshot) => {
    const msg = { id: snapshot.key, ...snapshot.val() };
    chatMessages.value.push(msg);
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) { chatMessages.value.shift(); }
    nextTick(() => { if (messageListRef.value) { messageListRef.value.scrollTop = messageListRef.value.scrollHeight; } });
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    if (msg.userId === currentUid && myAvatar) {
      showChatBubble(myAvatar, msg.message);
    } else if (otherPlayers[msg.userId] && otherPlayers[msg.userId].mesh) {
      showChatBubble(otherPlayers[msg.userId].mesh, msg.message);
    }
  });
};

const sendMessage = () => {
  if (!chatInput.value.trim() || !isReady.value || !auth.currentUser) return;
  const chatMessage = { userId: auth.currentUser.uid, userName: myUserName || '익명', message: chatInput.value.trim(), timestamp: serverTimestamp() };
  push(dbRef(rtdb, plazaChatPath), chatMessage);
  chatInput.value = '';
  if (chatInputRef.value) { chatInputRef.value.blur(); }
};

// --- [수정] Three.js 초기화 함수 (시작 위치, OrbitControls, 맵 스케일, 자동차 제거) ---
const initThree = () => {
  try {
      scene = new THREE.Scene();

      // 배경 이미지 로더
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        '/my_background.jpg',
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          scene.background = texture;
          scene.environment = texture;
          console.log("배경 이미지 로드 완료");
        },
        undefined,
        (err) => {
          console.error('배경 이미지 로드 실패:', err);
          scene.background = new THREE.Color(0xade6ff);
        }
      );

      // 안개 설정 (맵 크기에 맞게 범위 조정)
      scene.fog = new THREE.Fog(0xaaaaaa, 70, 200);

      // --- 시작 좌표 정의 (스크린샷 기준) ---
      const startX = 37.16;
      const startY = 5.49;
      const startZ = 7.85;
      // --- ---

      // 카메라 생성
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      // ★ 카메라 초기 위치를 스크린샷 각도(더 뒤, 더 위)로 설정
      camera.position.set(startX, startY + 5, startZ + 10);

      // 렌더러 생성
      if (!canvasRef.value) { console.error("캔버스 요소를 찾을 수 없습니다!"); return false; }
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);

      // 그림자 설정
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // --- OrbitControls 초기화 (클릭 이동 없으므로 'start' 리스너 제거) ---
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.screenSpacePanning = false;
      controls.minDistance = 2;
      controls.maxDistance = 20; // 줌 아웃 거리
      controls.maxPolarAngle = Math.PI / 2 - 0.05; // 바닥 아래로 못 보게
      controls.target.set(startX, startY + 1.0, startZ); // 초기 타겟 설정
      controls.update();
      // --- OrbitControls 초기화 끝 ---

      // --- 광원 설정 (맵 스케일에 맞게 조정) ---
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(50, 80, 40); // 광원 위치
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 200;
      dirLight.shadow.camera.left = -80;
      dirLight.shadow.camera.right = 80;
      dirLight.shadow.camera.top = 80;
      dirLight.shadow.camera.bottom = -80;
      dirLight.shadow.bias = -0.001;
      scene.add(dirLight);
      const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x444444, 0.6);
      scene.add(hemiLight);
      // --- 광원 설정 끝 ---

      // --- 도시 맵 로드 (스케일 150) ---
      loader.load(
        '/models/low_poly_city_pack.glb',
        (gltf) => {
          try {
              const city = gltf.scene;
              city.name = "cityMap";
              const box = new THREE.Box3().setFromObject(city);
              const size = box.getSize(new THREE.Vector3());
              const center = box.getCenter(new THREE.Vector3());
              console.log('도시 모델 원본 크기:', size);

              const desiredMaxSize = 150; // 맵 크기
              const scaleFactor = desiredMaxSize / Math.max(size.x, size.z);
              city.scale.set(scaleFactor, scaleFactor, scaleFactor);

              const scaledBox = new THREE.Box3().setFromObject(city);
              const scaledMinY = scaledBox.min.y;
              const groundLevelY = -scaledMinY;
              city.position.set(-center.x * scaleFactor, groundLevelY, -center.z * scaleFactor);

              city.traverse(child => {
                if (child.isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });

              scene.add(city);
              console.log(`도시 맵 로드 완료 (스케일: ${scaleFactor.toFixed(2)}, 바닥 높이 Y: ${groundLevelY.toFixed(2)})`);

              // --- 아바타 초기 위치 설정 ---
              if (myAvatar) {
                myAvatar.position.set(startX, startY, startZ);
                console.log(`내 아바타 초기 위치 설정: X=${startX}, Y=${startY.toFixed(2)}, Z=${startZ}`);
              }
              // --- 위치 재설정 끝 ---

          } catch(processError) {
              console.error('!!! 도시 맵 처리 중 심각한 오류 발생:', processError);
          }
        },
        undefined,
        (error) => {
          console.error('!!! 도시 맵 로드 실패 (GLTFLoader 에러):', error);
        }
      );
      // --- 도시 맵 로드 끝 ---

      // [삭제] 자동차 로드 코드 삭제

      clock = new THREE.Clock();
      return true;
  } catch (error) {
      console.error("Three.js 초기화 중 오류 발생:", error);
      return false;
  }
}; // initThree 함수 끝

// --- 플레이어 이동 로직 ---
const handleKeyDown = (event) => {
    if (chatInputRef.value === document.activeElement) return;
    keysPressed[event.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
    }
};
const handleKeyUp = (event) => { keysPressed[event.code] = false; };
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

// --- [수정] updatePlayerMovement (클릭 이동 제거, 카메라 연동, 로그 삭제) ---
const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value || !scene) return;

  let moved = false;
  let moveDirection = { x: 0, z: 0 };
  let currentAnimation = 'idle';
  let currentSpeedFactor = 1.0;

  // --- [삭제] 클릭/터치 이동 로직 (navigationTarget) 완전 삭제 ---

  // --- 키보드/조이스틱 이동 처리 ---
  if (joystickData.value.active && joystickData.value.distance > 10) {
    // 조이스틱 로직 (기존과 동일: 아바타가 조이스틱 방향으로 회전하며 전진)
    const targetRotationY = -joystickData.value.angle + Math.PI / 2;
    moveDirection.z = -1;
    moved = true;
    currentAnimation = 'walk';
    currentSpeedFactor = joystickData.value.force;

    let currentY = myAvatar.rotation.y; const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; let targetY = (targetRotationY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    const rotationChange = diff * deltaTime * 8;
    myAvatar.rotation.y += rotationChange;

  } else if (!joystickData.value.active) { // 키보드 입력
    // ▼▼▼ [핵심 수정] 키보드 조작 시 아바타 방향을 카메라 방향과 동기화 ▼▼▼
    const cameraEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    myAvatar.rotation.y = cameraEuler.y;
    // ▲▲▲ 수정 완료 ▲▲▲

    currentSpeedFactor = 1.0;
    if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) {
      moveDirection.x = 1; moved = true; currentAnimation = 'strafeLeft';
    }
    if (keysPressed['KeyD'] || keysPressed['ArrowRight']) {
      moveDirection.x = -1; moved = true; currentAnimation = 'strafeRight';
    }
    if (keysPressed['KeyW'] || keysPressed['ArrowUp']) {
      moveDirection.z = -1; moved = true;
      if (currentAnimation === 'idle') currentAnimation = 'walk';
    }
    if (keysPressed['KeyS'] || keysPressed['ArrowDown']) {
      moveDirection.z = 1; moved = true;
      if (currentAnimation === 'idle') currentAnimation = 'walkBackward';
    }
  }
  // --- 입력 처리 끝 ---

  // --- 이동 적용 (moved=true일 때) ---
  if (moved) {
    const velocity = new THREE.Vector3(
      moveDirection.x * moveSpeed * 0.7 * deltaTime, // 좌우 이동 속도
      0,
      moveDirection.z * moveSpeed * currentSpeedFactor * deltaTime // 앞뒤 이동 속도
    );
    velocity.applyQuaternion(myAvatar.quaternion); // 아바타 방향 적용
    myAvatar.position.add(velocity);
  }

  // --- 경계 처리 및 Y 위치 고정 (맵 스케일 150 기준) ---
  const boundary = 74.5;
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  
  const cityMap = scene.getObjectByName("cityMap");
  let groundY = myAvatar.position.y; // 기본값 (맵 로드 전)
  if (cityMap) {
      const raycaster = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);
      raycaster.set(myAvatar.position.clone().add(new THREE.Vector3(0, 1, 0)), down);
      const intersects = raycaster.intersectObject(cityMap, true);
      groundY = intersects.length > 0 ? intersects[0].point.y : cityMap.position.y;
  }
  myAvatar.position.y = groundY; // Y 위치 강제 고정
  // --- Y 위치 고정 끝 ---

  // ▼▼▼ [수정] 임시 로그 라인 삭제 ▼▼▼
  // console.log(`Avatar Position - X: ...`);
  // ▲▲▲ 삭제 완료 ▲▲▲

  // 이동/회전했으면 서버 업데이트
  if (moved) { throttledUpdate(); }

  // --- 애니메이션 전환 로직 ---
  const mixer = myAvatar.userData.mixer;
  const actions = myAvatar.userData.actions;
  const availableActions = Object.keys(actions);

  if (mixer && availableActions.length > 0) {
    const targetAction = actions[currentAnimation] || actions.idle;
    let currentPlayingAction = null;
    for (const key of availableActions) {
      if (actions[key].isRunning() && actions[key] !== targetAction) {
        currentPlayingAction = actions[key];
        break;
      }
    }
    if (targetAction && !targetAction.isRunning()) {
      targetAction.reset().play();
      if (currentPlayingAction) {
        currentPlayingAction.crossFadeTo(targetAction, 0.3);
      }
    } else if (!targetAction && actions.idle && !actions.idle.isRunning()) {
      actions.idle.reset().play();
      if (currentPlayingAction) {
        currentPlayingAction.crossFadeTo(actions.idle, 0.3);
      }
    }
  }
  // --- 애니메이션 전환 로직 끝 ---
}; // updatePlayerMovement 함수 끝

// --- [수정] updateOtherPlayersMovement (닉네임 지연 문제) ---
const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8;
  const moveThreshold = 0.01;
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (!player.mesh) continue;
    const mesh = player.mesh;
    
    // ▼▼▼ [수정] 닉네임 지연 문제 해결 (부모 matrixAutoUpdate = true) ▼▼▼
    mesh.matrixAutoUpdate = true;
    // ▲▲▲
    
    const distance = mesh.position.distanceTo(player.targetPosition);
    const wasMoving = player.isMoving;
    player.isMoving = distance > moveThreshold;
    mesh.position.lerp(player.targetPosition, lerpFactor);
    let currentY = mesh.rotation.y; let targetY = player.targetRotationY; const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    mesh.rotation.y += diff * lerpFactor;
    mesh.rotation.x = 0; mesh.rotation.z = 0;
    
    // ... (애니메이션 전환 로직 동일) ...
  }
};

// --- [수정] 애니메이션 루프 (닉네임 지연, 마커 제거) ---
const animate = () => {
  if (!renderer || !scene || !camera || !clock) return;
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  // 믹서 업데이트
  if (myAvatar && myAvatar.userData.mixer) { myAvatar.userData.mixer.update(deltaTime); }
  for (const userId in otherPlayers) { if (otherPlayers[userId].mixer) { otherPlayers[userId].mixer.update(deltaTime); } }

  // 이동 로직 호출
  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);

  // OrbitControls 업데이트
  if (controls) {
    if (myAvatar) {
      const targetLookAt = myAvatar.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      controls.target.lerp(targetLookAt, deltaTime * 5.0);
    }
    controls.update(); // 컨트롤 상태 업데이트
    
    // [삭제] 마커 숨김 로직 삭제
  }

  // [삭제] 강제 매트릭스 업데이트 코드 삭제
  // if (scene) { scene.updateMatrixWorld(true); }

  // 씬 렌더링
  renderer.render(scene, camera);
};

// --- 창 크기 조절 처리 ---
const handleResize = () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

// --- [수정] onMounted (클릭 리스너 제거) ---
onMounted(async () => {
  console.log('--- DEPLOY TEST VERSION 14 --- THIS IS THE NEWEST CODE ---');

  if (!auth.currentUser) { /* ... 로그인 확인 ... */ return; }
  const currentUid = auth.currentUser.uid;

  const initSuccess = initThree();
  if (!initSuccess) { /* ... 초기화 실패 처리 ... */ return; }

  loadingMessage.value = '애니메이션 로딩 중...';
  const preloadedAnimations = await loadAnimations();
  if (!preloadedAnimations.idle || !preloadedAnimations.walk) {
    loadingMessage.value = '기본 애니메이션 로드 실패. 애니메이션 없이 진행합니다.';
  }

  // 3. 브라우저 이벤트 리스너 등록
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // ▼▼▼ [삭제] 클릭/터치 이동 리스너 (down, up) 제거 ▼▼▼
  // if (canvasRef.value) { ... }
  // ▲▲▲ 삭제 완료 ▲▲▲

  animate(); // 렌더링 루프 시작

  // 4. Firestore에서 사용자 정보 가져오기
  loadingMessage.value = '내 정보 로딩 중...';
  try {
      const userDoc = await getDoc(doc(db, 'users', currentUid));
      if (userDoc.exists()) {
          myAvatarUrl = userDoc.data().avatarUrl || '';
          myUserName = userDoc.data().name || '익명';
          if (!myAvatarUrl) {
              console.warn("Firestore에서 아바타 URL을 찾을 수 없습니다. 기본 아바타가 로드됩니다.");
          } else {
              console.log("Firestore에서 가져온 아바타 URL:", myAvatarUrl);
          }
      } else {
          console.error("Firestore 사용자 문서 없음! 기본 아바타로 진행합니다.");
          myUserName = '익명'; myAvatarUrl = '';
      }
  } catch (error) { /* ... 에러 처리 ... */ return; }

  // 5. 내 아바타 로드 및 닉네임 추가
  loadingMessage.value = '내 아바타 로딩 중...';
  try {
    console.log(`[중요] loadAvatar 함수에 전달될 URL: '${myAvatarUrl}' (타입: ${typeof myAvatarUrl})`);
    const loadedModel = await loadAvatar(myAvatarUrl, preloadedAnimations);
    myAvatar = loadedModel;

    if (myUserName && myUserName !== '익명') {
        const myNickname = createNicknameSprite(myUserName);
        // ▼▼▼ [수정] 닉네임을 visuals 그룹에 추가 (닉네임 지연 문제) ▼▼▼
        if (myAvatar.userData.visuals) {
            myAvatar.userData.visuals.add(myNickname);
        } else {
            myAvatar.add(myNickname);
        }
        // ▲▲▲ 수정 완료 ▲▲▲
    }
    scene.add(myAvatar);
    console.log('[DEBUG] myAvatar added to scene (초기 위치는 맵 로드 후 설정됨)');

  } catch (error) { /* ... 아바타 로드 실패 시 처리 ... */ }

  // 6. 조이스틱 초기화
  await nextTick();
  const joystickZone = document.getElementById('joystick-zone');
  if (joystickZone) {
    try {
        joystickManager = nipplejs.create({ /* ... 조이스틱 설정 ... */ });
        joystickManager.on('move', handleJoystickMove);
        joystickManager.on('end', handleJoystickEnd);
        console.log("조이스틱 생성 완료");
    } catch (e) { console.error("조이스틱 생성 실패:", e); }
  } else { console.warn("조이스틱 영역('#joystick-zone')을 찾을 수 없습니다."); }

  // 7. RTDB 연결 및 리스너 시작
  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza();
  if(isReady.value){
    listenToOtherPlayers(preloadedAnimations);
    listenToChat();
  } else { loadingMessage.value = 'Plaza 연결 실패.'; return; }
  isLoading.value = false;
}); // onMounted 함수 끝

// --- [수정] onUnmounted (클릭 리스너 제거) ---
onUnmounted(() => {
  // 이벤트 리스너 제거
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);

  // ▼▼▼ [삭제] 클릭/터치 이동 리스너 제거 ▼▼▼
  // if (canvasRef.value) {
  //   canvasRef.value.removeEventListener('pointerdown', handlePointerDown);
  //   canvasRef.value.removeEventListener('pointerup', handlePointerUp);
  // }
  // ▲▲▲ 삭제 완료 ▲▲▲

  // RTDB 리스너 제거
  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);

  // RTDB 내 정보 제거 (세션 종료 시)
  if (playerRef) remove(playerRef);

  // 조이스틱 제거
  if (joystickManager) {
    joystickManager.off('move', handleJoystickMove);
    joystickManager.off('end', handleJoystickEnd);
    joystickManager.destroy();
    joystickManager = null;
  }

  // 내 아바타 말풍선 리소스 정리
  if (myAvatar && myAvatar.activeBubble) {
    clearTimeout(myAvatar.activeBubble.timeoutId);
    if (myAvatar.activeBubble.material.map) {
        myAvatar.activeBubble.material.map.dispose();
    }
    myAvatar.activeBubble.material.dispose();
    myAvatar.activeBubble = null;
  }

  // OrbitControls 리소스 해제
  if (controls) {
    controls.dispose();
    controls = null;
  }

  // [삭제] 타겟 마커 리소스 해제 (주석 처리됨)
  /*
  if (targetMarker) {
      if (targetMarker.geometry) targetMarker.geometry.dispose();
      if (targetMarker.material) targetMarker.material.dispose();
      if (scene) scene.remove(targetMarker);
      targetMarker = null;
  }
  */

  // Three.js 리소스 정리
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  if (scene) {
     scene.traverse(object => {
       if (object.isMesh) {
         if (object.geometry) { object.geometry.dispose(); }
         if (Array.isArray(object.material)) {
           object.material.forEach(material => {
             if (material.map) material.map.dispose();
             material.dispose();
           });
         } else if (object.material) {
           if (object.material.map) object.material.map.dispose();
           object.material.dispose();
         }
       } else if (object instanceof THREE.Sprite) {
         if (object.material.map) object.material.map.dispose();
         object.material.dispose();
       }
     });
    scene = null;
  }
  // 다른 전역 참조들도 제거
  camera = null;
  clock = null;
  myAvatar = null;
  otherPlayers = {};
}); // onUnmounted 함수 끝

</script>

<style scoped>
/* 이전 스타일과 동일 */
.utopia-container { width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; position: relative; background-color: #ade6ff; }
.main-canvas { display: block; width: 100%; height: 100%; }
.loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; font-size: 1.1em; }
.spinner { border: 4px solid rgba(255, 255, 255, 0.3); width: 40px; height: 40px; border-radius: 50%; border-left-color: #fff; animation: spin 1s linear infinite; margin-bottom: 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.chat-ui {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 300px;
  max-width: 80%;
  max-height: 20%; /* 모바일 높이 조절 */
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  z-index: 5;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5);
}
.message-list { flex-grow: 1; overflow-y: auto; margin-bottom: 10px; color: white; font-size: 0.9em; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.5); }
.message-list::-webkit-scrollbar { width: 5px; } .message-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.5); border-radius: 3px;} .message-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px;} .message-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }
.chat-message { margin-bottom: 6px; word-break: break-all; line-height: 1.4; } .chat-message strong { color: #f1c40f; margin-right: 5px; }
.chat-ui input { width: 100%; padding: 10px; border: none; border-radius: 4px; background-color: rgba(255, 255, 255, 0.15); color: white; outline: none; font-size: 0.9em; box-sizing: border-box; } .chat-ui input::placeholder { color: rgba(255, 255, 255, 0.6); } .chat-ui input:disabled { background-color: rgba(255, 255, 255, 0.1); cursor: not-allowed; }
.joystick-zone { position: absolute; bottom: 30px; right: 30px; width: 150px; height: 150px; z-index: 6; opacity: 0.7; }
</style>