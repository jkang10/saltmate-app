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
let cameraLookAtTarget = new THREE.Vector3(0, 1.0, 0);
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

// --- [신규] 헬퍼 함수: 애니메이션 파일 로드 ---
const loadAnimations = async () => {
  const animationPaths = {
    idle: '/animations/M_Standing_Idle_Variations_008.glb', // Idle 애니메이션 경로
    walk: '/animations/F_Walk_003.glb'                     // Walk 애니메이션 경로
  };
  const loadedAnimations = { idle: null, walk: null };

  try {
    const [idleGltf, walkGltf] = await Promise.all([
      loader.loadAsync(animationPaths.idle),
      loader.loadAsync(animationPaths.walk)
    ]);

    if (idleGltf.animations && idleGltf.animations.length > 0) {
      loadedAnimations.idle = idleGltf.animations[0]; // 첫 번째 애니메이션 클립 사용
      console.log('Idle 애니메이션 클립 로드 성공:', loadedAnimations.idle.name);
    } else {
      console.error('Idle 애니메이션 파일에 클립이 없습니다:', animationPaths.idle);
    }

    if (walkGltf.animations && walkGltf.animations.length > 0) {
      loadedAnimations.walk = walkGltf.animations[0]; // 첫 번째 애니메이션 클립 사용
      console.log('Walk 애니메이션 클립 로드 성공:', loadedAnimations.walk.name);
    } else {
      console.error('Walk 애니메이션 파일에 클립이 없습니다:', animationPaths.walk);
    }

    return loadedAnimations; // { idle: AnimationClip | null, walk: AnimationClip | null } 반환

  } catch (error) {
    console.error('애니메이션 로딩 중 오류 발생:', error);
    return loadedAnimations; // 실패 시에도 null 값 반환
  }
};

// --- 헬퍼 함수: 아바타 로드 (외부 애니메이션 적용) ---
const loadAvatar = (url, animations) => {
  return new Promise((resolve) => {
    const model = new THREE.Group();
    model.position.set(0, 0, 0);
    model.userData.mixer = null;
    model.userData.actions = {};

    // URL 없거나 GLB 아닐 때 기본 큐브 생성
    if (!url || !url.endsWith('.glb')) {
      console.warn("아바타 URL이 유효하지 않거나 GLB 파일이 아닙니다. 기본 큐브를 사용합니다.", url);
      const visuals = new THREE.Group();
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
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
          if (child.isMesh) {
            child.geometry.translate(-center.x, -box.min.y, -center.z);
            // --- 그림자 설정 (렉 진단 후 다시 활성화) ---
            child.castShadow = true;
            // 아바타 메쉬는 그림자를 받지 않음 (성능 및 시각적 자연스러움)
            // child.receiveShadow = true;
          }
          child.matrixAutoUpdate = true;
        });

        visuals.scale.set(0.7, 0.7, 0.7);
        visuals.position.set(0, 0, 0);
        visuals.rotation.set(0, 0, 0);
        visuals.matrixAutoUpdate = true;
        model.add(visuals);

        // --- 미리 로드된 애니메이션 적용 로직 ---
        if (animations && animations.idle && animations.walk) {
          const mixer = new THREE.AnimationMixer(visuals);
          model.userData.mixer = mixer;

          const idleAction = mixer.clipAction(animations.idle);
          idleAction.play();
          model.userData.actions.idle = idleAction;

          const walkAction = mixer.clipAction(animations.walk);
          model.userData.actions.walk = walkAction;

          console.log(`[${url}] 외부 Idle, Walk 애니메이션 적용 완료`);
        } else {
          console.warn(`[${url}] 미리 로드된 Idle 또는 Walk 애니메이션 클립이 없습니다.`);
          if (animations && animations.idle) {
             const mixer = new THREE.AnimationMixer(visuals);
             model.userData.mixer = mixer;
             const idleAction = mixer.clipAction(animations.idle);
             idleAction.play();
             model.userData.actions.idle = idleAction;
             console.log(`[${url}] 외부 Idle 애니메이션만 적용`);
          }
        }
        // --- 애니메이션 적용 로직 끝 ---

        resolve(model);
      },
      undefined,
      (error) => {
        console.error('아바타 로딩 실패:', error, 'URL:', url);
        const visuals = new THREE.Group();
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
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

// --- 헬퍼 함수: 닉네임 스프라이트 생성 ---
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
      targetPosition: new THREE.Vector3(playerData.position?.x ?? 0, playerData.position?.y ?? 0, playerData.position?.z ?? 0), // Nullish coalescing
      targetRotationY: playerData.rotationY ?? 0, // Nullish coalescing
      userName: playerData.userName || '익명',
      isMoving: false
    };
    try {
      const loadedModel = await loadAvatar(playerData.avatarUrl, preloadedAnimations);
      console.log(`${playerData.userName || userId} 아바타 로드 완료 (애니메이션 포함)`);
      if (scene && otherPlayers[userId]) {
          loadedModel.position.copy(otherPlayers[userId].targetPosition); // 초기 위치 설정
          loadedModel.rotation.y = otherPlayers[userId].targetRotationY; // 초기 회전 설정
          if (otherPlayers[userId].userName !== '익명') {
              const otherNickname = createNicknameSprite(otherPlayers[userId].userName);
              loadedModel.add(otherNickname);
              console.log(`${playerData.userName || userId} 닉네임 추가 완료`);
          }
          scene.add(loadedModel);
          otherPlayers[userId].mesh = loadedModel;
          otherPlayers[userId].mixer = loadedModel.userData.mixer;
          otherPlayers[userId].actions = loadedModel.userData.actions;
          console.log(`${playerData.userName || userId} 씬에 추가 완료 (애니메이션 설정 포함)`);
      } else {
          console.warn(`${userId} 씬에 추가 실패 (씬이 없거나 이미 퇴장함)`);
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
    } else {
        console.warn(`[onChildChanged] ${userId}의 rotationY가 유효하지 않습니다.`, playerData);
    }
    // Nullish coalescing 추가하여 안전하게 접근
    player.targetPosition.set(playerData.position.x ?? 0, playerData.position.y ?? 0, playerData.position.z ?? 0);
  });

  onChildRemoved(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return;
    const playerToRemove = otherPlayers[userId];
    if (playerToRemove.mesh && playerToRemove.mesh.activeBubble) {
      clearTimeout(playerToRemove.mesh.activeBubble.timeoutId);
      playerToRemove.mesh.activeBubble.material.map.dispose();
      playerToRemove.mesh.activeBubble.material.dispose();
      console.log(`${userId}의 말풍선 리소스 제거`);
    }
    if (scene && playerToRemove.mesh) { scene.remove(playerToRemove.mesh); }
    if (playerToRemove.mesh) {
        playerToRemove.mesh.traverse(child => {
           if (child.isMesh) {
             if (child.geometry) child.geometry.dispose();
             if (Array.isArray(child.material)) {
               child.material.forEach(material => {
                 if (material.map) material.map.dispose();
                 material.dispose();
               });
             } else if (child.material) {
               if (child.material.map) child.material.map.dispose();
               child.material.dispose();
             }
           }
           else if (child instanceof THREE.Sprite) {
               if (child.material.map) child.material.map.dispose();
               child.material.dispose();
           }
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
    const currentUid = auth.currentUser?.uid; // Optional chaining
    if (!currentUid) return; // 로그인 안 되어 있으면 종료
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

// --- Three.js 초기화 함수 ---
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
scene.fog = new THREE.Fog(0xaaaaaa, 20, 80);

      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 1.6, 4); // ★ 초기 카메라 위치 (맵 로드 후 재조정됨)

      if (!canvasRef.value) { console.error("캔버스 요소를 찾을 수 없습니다!"); return false; }
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);

      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // 광원 설정
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2); dirLight.position.set(20, 30, 15);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 100;
      dirLight.shadow.camera.left = -40;
      dirLight.shadow.camera.right = 40;
      dirLight.shadow.camera.top = 40;
      dirLight.shadow.camera.bottom = -40;
      dirLight.shadow.bias = -0.001;
      scene.add(dirLight);
      const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x444444, 0.6); scene.add(hemiLight);

// --- 도시 맵 로드 ---
      loader.load(
        '/models/low_poly_city_pack.glb',
        (gltf) => {
          try {
              const city = gltf.scene;
              city.name = "cityMap"; // 이름 부여

              const box = new THREE.Box3().setFromObject(city);
              const size = box.getSize(new THREE.Vector3());
              const center = box.getCenter(new THREE.Vector3());
              console.log('도시 모델 원본 크기:', size);

              const desiredMaxSize = 50;
              const scaleFactor = desiredMaxSize / Math.max(size.x, size.z);
              city.scale.set(scaleFactor, scaleFactor, scaleFactor);

              const scaledBox = new THREE.Box3().setFromObject(city);
              const scaledMinY = scaledBox.min.y;
              const groundLevelY = -scaledMinY; // 가장 낮은 지점 기준 Y 오프셋
              city.position.set(-center.x * scaleFactor, groundLevelY, -center.z * scaleFactor);

              city.traverse(child => {
                if (child.isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                }
              });

              scene.add(city);
              console.log(`도시 맵 로드 완료 (원본 재질 사용, 스케일: ${scaleFactor.toFixed(2)}, 바닥 높이 Y: ${groundLevelY.toFixed(2)})`);

              // --- ★★★ 새로운 시작 좌표 적용 ★★★ ---
              const startX = 12.92;
              const startY = 1.83; // 콘솔에서 확인한 Y값 사용
              const startZ = -0.90;

              // Raycasting 로직은 Y값 확인용으로 남겨두거나 제거해도 됨 (여기서는 주석 처리)
              /*
              const raycaster = new THREE.Raycaster();
              const down = new THREE.Vector3(0, -1, 0);
              raycaster.set(new THREE.Vector3(startX, 10, startZ), down);
              const intersects = raycaster.intersectObject(city, true);
              let confirmedHeight = groundLevelY; // 기본값
              if (intersects.length > 0) { confirmedHeight = intersects[0].point.y; }
              console.log(`확인된 시작 지점 높이: ${confirmedHeight.toFixed(2)}, 사용할 높이: ${startY}`);
              */
              // --- ★★★ ---

              // --- 아바타/카메라 초기 위치 설정 ---
              if (myAvatar) {
                myAvatar.position.set(startX, startY, startZ);
                console.log(`내 아바타 초기 위치 설정: X=${startX}, Y=${startY}, Z=${startZ}`);
              }
              // 카메라 위치도 새 시작 위치 기준으로 설정 (뒤쪽 위)
              camera.position.set(startX, startY + 1.6, startZ + 4);
              // 카메라는 아바타의 약간 위를 바라보도록 설정
              cameraLookAtTarget.set(startX, startY + 1.0, startZ);
              // --- 위치 재설정 끝 ---

          } catch(processError) {
              console.error('!!! 도시 맵 처리 중 심각한 오류 발생:', processError);
          }
        },
        undefined,
        (error) => { console.error('!!! 도시 맵 로드 실패 (GLTFLoader 에러):', error); /* ... */ }
      );
      // --- 도시 맵 로드 끝 ---

      clock = new THREE.Clock();
      return true;
  } catch (error) {
      console.error("Three.js 초기화 중 오류 발생:", error);
      return false;
  }
};

// --- 플레이어 이동 로직 ---
const handleKeyDown = (event) => {
    if (chatInputRef.value === document.activeElement) return;
    keysPressed[event.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) { // Space 추가
        event.preventDefault();
    }
};
const handleKeyUp = (event) => { keysPressed[event.code] = false; };
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

// 매 프레임 호출: 내 아바타 위치/회전 업데이트
const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value || !scene) return;

  // --- 이동/회전 상태 변수 초기화 ---
  let moved = false;
  let rotationAmount = 0;
  let applyRotation = false;
  let applyMovement = false;
  let moveDirectionZ = 0;
  let targetRotationY = myAvatar.rotation.y;
  let isTurningAround = false;

  // --- 입력 처리 (조이스틱, 키보드) ---
  if (joystickData.value.active && joystickData.value.distance > 10) {
    targetRotationY = -joystickData.value.angle + Math.PI / 2;
    applyRotation = true;
    applyMovement = true;
    moveDirectionZ = -1;
  } else if (!joystickData.value.active) {
    if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) { rotationAmount = rotateSpeed * deltaTime; applyRotation = true; }
    if (keysPressed['KeyD'] || keysPressed['ArrowRight']) { rotationAmount = -rotateSpeed * deltaTime; applyRotation = true; }
    if (keysPressed['KeyW'] || keysPressed['ArrowUp']) { moveDirectionZ = -1; applyMovement = true; }
    if (keysPressed['KeyS'] || keysPressed['ArrowDown']) {
      targetRotationY = myAvatar.rotation.y + Math.PI;
      applyRotation = true;
      moveDirectionZ = -1;
      applyMovement = true;
      isTurningAround = true;
    }
  }

  // --- 회전 적용 ---
  if (applyRotation) {
    if (joystickData.value.active || isTurningAround) {
        let currentY = myAvatar.rotation.y; const PI2 = Math.PI * 2;
        currentY = (currentY % PI2 + PI2) % PI2; targetRotationY = (targetRotationY % PI2 + PI2) % PI2;
        let diff = targetRotationY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
        const rotationSpeedFactor = isTurningAround ? 12 : 8;
        const rotationChange = diff * deltaTime * rotationSpeedFactor;
        myAvatar.rotation.y += rotationChange;
        if (Math.abs(rotationChange) > 0.001) moved = true;
    } else {
        myAvatar.rotation.y += rotationAmount;
        if (Math.abs(rotationAmount) > 0.001) moved = true;
    }
  }

  // --- 이동 적용 ---
  if (applyMovement && moveDirectionZ === -1) {
    let currentSpeedFactor = 1.0;
    if (joystickData.value.active) { currentSpeedFactor = joystickData.value.force; }
    const moveAmount = moveDirectionZ * moveSpeed * currentSpeedFactor * deltaTime;
    const velocity = new THREE.Vector3(0, 0, moveAmount);
    velocity.applyQuaternion(myAvatar.quaternion);
    myAvatar.position.add(velocity);
    if (Math.abs(moveAmount) > 0.001) moved = true;
  } else {
    moved = moved || false;
  }

  // --- 경계 처리 (X, Z만) ---
  const boundaryX = 24.5; const boundaryZ = 24.5;
  myAvatar.position.x = Math.max(-boundaryX, Math.min(boundaryX, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundaryZ, Math.min(boundaryZ, myAvatar.position.z));

  // ▼▼▼ [수정] Raycasting 로직 및 Y 위치 고정 ▼▼▼
  const cityMap = scene.getObjectByName("cityMap");
  let groundY = myAvatar.position.y; // 기본값은 현재 높이

  if (cityMap) {
      // ★ Raycaster와 down 변수를 사용할 때 선언 ★
      const raycaster = new THREE.Raycaster();
      const down = new THREE.Vector3(0, -1, 0);

      raycaster.set(myAvatar.position.clone().add(new THREE.Vector3(0, 1, 0)), down);
      // ★ intersects 변수 선언 ★
      const intersects = raycaster.intersectObject(cityMap, true);

      // ★ if 블록 안에서 intersects 사용 ★
      if (intersects.length > 0) {
          groundY = intersects[0].point.y; // 찾은 지면 높이
      } else {
          groundY = cityMap.position.y; // 못 찾으면 맵 기본 높이
      }
  }
  myAvatar.position.y = groundY; // Y 위치 고정
  // ▲▲▲ [수정 끝] ▲▲▲

  // 이동/회전했으면 서버 업데이트
  if (moved) { throttledUpdate(); }

  // --- 애니메이션 전환 로직 ---
  const mixer = myAvatar.userData.mixer;
  const actions = myAvatar.userData.actions;
  const idleAction = actions.idle;
  const walkAction = actions.walk;

  if (mixer && idleAction && walkAction) {
    if (moved && !walkAction.isRunning()) {
      walkAction.reset().play();
      idleAction.crossFadeTo(walkAction, 0.3);
    } else if (!moved && !idleAction.isRunning()) {
      idleAction.reset().play();
      walkAction.crossFadeTo(idleAction, 0.3);
    }
  } else if (mixer && idleAction && !walkAction && !idleAction.isRunning()) {
    idleAction.reset().play();
  }
  // --- 애니메이션 전환 로직 끝 ---
};

const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8;
  const moveThreshold = 0.01;
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (!player.mesh) continue;
    const mesh = player.mesh;
    const distance = mesh.position.distanceTo(player.targetPosition);
    const wasMoving = player.isMoving;
    player.isMoving = distance > moveThreshold;
    mesh.position.lerp(player.targetPosition, lerpFactor);
    let currentY = mesh.rotation.y; let targetY = player.targetRotationY; const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    mesh.rotation.y += diff * lerpFactor;
    mesh.rotation.x = 0; mesh.rotation.z = 0;
    const mixer = player.mixer;
    const actions = player.actions;
    const idleAction = actions.idle;
    const walkAction = actions.walk;
    if (mixer && idleAction && walkAction) {
      if (player.isMoving && !wasMoving) {
        walkAction.reset().play();
        idleAction.crossFadeTo(walkAction, 0.3);
      } else if (!player.isMoving && wasMoving) {
        idleAction.reset().play();
        walkAction.crossFadeTo(idleAction, 0.3);
      }
    } else if (mixer && idleAction && !walkAction && !idleAction.isRunning()) {
       idleAction.reset().play();
    }
  }
};

// --- 애니메이션 루프 ---
// --- 애니메이션 루프 ---
const animate = () => {
  if (!renderer || !scene || !camera || !clock) return;
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  // 믹서 업데이트 (변경 없음)
  if (myAvatar && myAvatar.userData.mixer) { myAvatar.userData.mixer.update(deltaTime); }
  for (const userId in otherPlayers) { if (otherPlayers[userId].mixer) { otherPlayers[userId].mixer.update(deltaTime); } }

  // 이동 로직 호출 (변경 없음)
  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);

  // --- ★ 카메라 추적 로직 수정 ★ ---
  if (myAvatar) {
      // 고정된 오프셋 (뒤쪽 위)
      const desiredOffset = new THREE.Vector3(0, 3.0, 5.0);
      const lerpFactor = deltaTime * 5.0; // 부드러움 정도

      // ▼▼▼ 아바타 회전을 적용하지 않고 카메라 목표 위치 계산 ▼▼▼
      // const cameraOffset = desiredOffset.clone().applyQuaternion(myAvatar.quaternion); // <-- 이 줄 삭제 또는 주석 처리
      const cameraOffset = desiredOffset.clone(); // <-- 고정 오프셋 사용
      const targetPosition = myAvatar.position.clone().add(cameraOffset); // 아바타 위치 + 고정 오프셋
      // ▲▲▲ 수정 끝 ▲▲▲

      camera.position.lerp(targetPosition, lerpFactor); // 카메라 위치 보간

      // ▼▼▼ 아바타 회전과 상관없이 아바타의 특정 높이를 바라보도록 수정 ▼▼▼
      const targetLookAt = myAvatar.position.clone().add(new THREE.Vector3(0, 1.0, 0)); // 아바타 머리 근처 높이
      // ▲▲▲ 수정 끝 ▲▲▲

      cameraLookAtTarget.lerp(targetLookAt, lerpFactor); // 바라볼 지점 보간
      camera.lookAt(cameraLookAtTarget); // 카메라가 항상 아바타 중심 약간 위를 보도록 함
  }
  // --- ★ 카메라 추적 로직 수정 끝 ★ ---

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
  console.log('--- DEPLOY TEST VERSION 14 --- THIS IS THE NEWEST CODE ---');
  if (!auth.currentUser) {
    console.error("로그인되지 않음.");
    loadingMessage.value = "로그인이 필요합니다.";
    isLoading.value = false;
    return;
  }
  const currentUid = auth.currentUser.uid;
  const initSuccess = initThree();
  if (!initSuccess) {
      loadingMessage.value = "3D 환경 초기화 실패.";
      isLoading.value = false;
      return;
  }
  loadingMessage.value = '애니메이션 로딩 중...';
  const preloadedAnimations = await loadAnimations();
  if (!preloadedAnimations.idle || !preloadedAnimations.walk) {
    loadingMessage.value = '기본 애니메이션 로드 실패. 애니메이션 없이 진행합니다.';
  }
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  animate();
  loadingMessage.value = '내 정보 로딩 중...';
  try {
      const userDoc = await getDoc(doc(db, 'users', currentUid));
      if (userDoc.exists()) {
          myAvatarUrl = userDoc.data().avatarUrl || '';
          myUserName = userDoc.data().name || '익명';
      } else {
          console.error("Firestore 사용자 문서 없음!");
          myUserName = '익명';
      }
  } catch (error) {
      console.error("Firestore 정보 가져오기 실패:", error);
      loadingMessage.value = '내 정보 로딩 실패.';
      isLoading.value = false;
      return;
  }
  loadingMessage.value = '내 아바타 로딩 중...';
  try {
    const loadedModel = await loadAvatar(myAvatarUrl, preloadedAnimations);
    myAvatar = loadedModel;
    myAvatar.position.set(0, 0, 0);
    myAvatar.rotation.set(0, 0, 0);
    if (myUserName && myUserName !== '익명') {
        const myNickname = createNicknameSprite(myUserName);
        myNickname.matrixAutoUpdate = true;
        myAvatar.add(myNickname);
    }
scene.add(myAvatar);
// ★★★ 이 로그가 현재 아바타의 초기 좌표를 보여줍니다 ★★★
console.log('[DEBUG] myAvatar added to scene, position:', myAvatar.position);
console.log('[DEBUG] myAvatar.children.length:', myAvatar.children.length);
  } catch (error) {
    console.error("내 아바타 로드 중 에러 발생:", error);
    loadingMessage.value = '아바타 로딩 실패. 기본 아바타로 시작합니다.';
    if (!myAvatar) { myAvatar = new THREE.Group(); myAvatar.matrixAutoUpdate = true; }
    try {
      const fallbackModel = await loadAvatar(null, preloadedAnimations);
      myAvatar = fallbackModel;
      scene.add(myAvatar);
    } catch (e) {
        console.error("기본 아바타 로드조차 실패.", e);
        isLoading.value = false;
        return;
    }
  }
  await nextTick();
  const joystickZone = document.getElementById('joystick-zone');
  if (joystickZone) {
    try {
        joystickManager = nipplejs.create({
          zone: joystickZone, mode: 'static', position: { right: '80px', bottom: '80px' },
          color: 'rgba(255, 255, 255, 0.5)', size: 100
        });
        joystickManager.on('move', handleJoystickMove);
        joystickManager.on('end', handleJoystickEnd);
        console.log("조이스틱 생성 완료");
    } catch (e) { console.error("조이스틱 생성 실패:", e); }
  } else { console.warn("조이스틱 영역('#joystick-zone')을 찾을 수 없습니다."); }
  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza();
  if(isReady.value){
    listenToOtherPlayers(preloadedAnimations);
    listenToChat();
  } else { loadingMessage.value = 'Plaza 연결 실패.'; return; }
  isLoading.value = false;
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);
  if (playerRef) remove(playerRef);
  if (joystickManager) {
    joystickManager.off('move', handleJoystickMove);
    joystickManager.off('end', handleJoystickEnd);
    joystickManager.destroy();
    joystickManager = null;
  }
  if (myAvatar && myAvatar.activeBubble) {
    clearTimeout(myAvatar.activeBubble.timeoutId);
    myAvatar.activeBubble.material.map.dispose();
    myAvatar.activeBubble.material.dispose();
  }
  if (renderer) { renderer.dispose(); renderer = null; }
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
  camera = null; clock = null; myAvatar = null;
  otherPlayers = {};
});

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