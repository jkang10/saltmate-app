<template>
  <div class="utopia-container">
    <canvas ref="canvasRef" class="main-canvas" tabindex="0"></canvas>

    <video
      ref="cinemaVideoRef"
      id="cinema-video"
      style="position: absolute; top: -9999px; left: -9999px; opacity: 0;"
      crossorigin="anonymous"
      playsinline
      webkit-playsinline
      loop
      muted
      autoplay
      preload="auto"
      @timeupdate="checkVideoProgress"
      @error="(e) => console.error('비디오 로드 에러:', e.target.error, e.target.currentSrc)"
    >
      <source src="/videos/helia_tea.mp4" type="video/mp4">
    </video>

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

    <div class="user-controls">
      <button @click="toggleMute" :class="{ 'active': !isMuted }">
        {{ isMuted ? '🔇 소리 켜기' : '🔊 소리 끄기' }}
      </button>
      <button @click="toggleMic" :class="{ 'active': isMicOn }">
        {{ isMicOn ? '🎤 마이크 끄기' : '🎙️ 마이크 켜기' }}
      </button>
    </div>

    <div v-if="isAdmin" class="admin-video-controls">
      <h3>🎥 시네마 제어</h3>
      <div class="admin-buttons">
        <button @click="toggleVideoPlay">{{ isVideoPlaying ? '일시정지' : '재생' }}</button>
        <button @click="syncVideoTime">동기화</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { auth, db, rtdb, functions } from '@/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  ref as dbRef, onChildAdded, onChildChanged, onChildRemoved, onValue,
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove,
  update
} from 'firebase/database';
import nipplejs from 'nipplejs';
import AgoraRTC from "agora-rtc-sdk-ng";

// --- 유틸리티 함수 ---
const isFiniteNumber = (num) => (typeof num === 'number' && isFinite(num));

// --- 상태 변수 ---
const canvasRef = ref(null);
const cinemaVideoRef = ref(null);
const isLoading = ref(true);
const loadingMessage = ref('유토피아 입장 준비 중...');
const isReady = ref(false);
const isAdmin = ref(false);
const isVideoPlaying = ref(false);
const isMuted = ref(true); 
const rewardClaimedLocal = ref(false);

// --- Agora 변수 ---
const agoraAppId = "9d76fd325fea49d4870da2bbea41fd29"; 
const agoraChannel = "plaza_voice_chat";
const agoraToken = null; 
const agoraClient = ref(null);
const localAudioTrack = ref(null);
const isMicOn = ref(false);

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
let controls; 
const loader = new GLTFLoader();

// --- Firebase 경로 ---
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
const plazaVideoPath = 'plaza/videoState';
let playerRef = null;
let playersListenerRef = null;
let chatListenerRef = null;
let videoListenerRef = null;

// --- 이동 관련 ---
// [수정] 속도 2.0 유지 (적절한 속도)
const moveSpeed = 2.0; 
const keysPressed = reactive({});
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 });
let joystickManager = null;

// --- [핵심 수정] Agora 초기화 (문자열 UID 직접 사용) ---
const initAgora = async () => {
  if (!auth.currentUser) return;
  
  // [중요] 변환 없이 Firebase UID 문자열 그대로 사용
  const currentUid = auth.currentUser.uid;

  try {
    agoraClient.value = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

    // 말하는 사람 감지
    agoraClient.value.enableAudioVolumeIndicator();
    agoraClient.value.on("volume-indicator", (volumes) => {
      volumes.forEach((volumeInfo) => {
        const { uid, level } = volumeInfo;
        // 민감도 설정 (40 이상일 때만 아이콘 표시)
        const isTalking = level > 40; 

        // 내 목소리 (uid === 0) 또는 다른 사람 (문자열 ID)
        if (uid === 0 || uid === currentUid) {
            updateSpeakingIndicator(currentUid, isTalking);
        } else {
            updateSpeakingIndicator(uid, isTalking);
        }
      });
    });

    // [중요] 오디오 구독 및 재생
    agoraClient.value.on("user-published", async (user, mediaType) => {
      await agoraClient.value.subscribe(user, mediaType);
      if (mediaType === "audio") {
        user.audioTrack.play(); // 소리 재생
        console.log(`[Agora] Audio playing for user: ${user.uid}`);
      }
    });

    agoraClient.value.on("user-unpublished", (user, mediaType) => {
      if (mediaType === "audio") {
        if (user.audioTrack) user.audioTrack.stop();
      }
    });

    // [중요] 문자열 UID로 입장
    await agoraClient.value.join(agoraAppId, agoraChannel, agoraToken, currentUid);
    console.log(`Agora 입장 성공 (String UID: ${currentUid})`);

  } catch (error) {
    console.error("Agora 초기화 실패:", error);
  }
};

// --- 말하는 표시 업데이트 (문자열 ID 매칭) ---
const updateSpeakingIndicator = (targetUid, isSpeaking) => {
  let targetMesh = null;
  const currentUid = auth.currentUser?.uid;

  if (targetUid === currentUid) {
    targetMesh = myAvatar;
  } else if (otherPlayers[targetUid]) {
    // 문자열 ID로 바로 찾음
    targetMesh = otherPlayers[targetUid].mesh;
  }

  if (!targetMesh) return;

  const existingIcon = targetMesh.getObjectByName("speakingIcon");

  if (isSpeaking) {
    if (!existingIcon) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 64; canvas.height = 64;
      context.fillStyle = '#00FF00'; 
      context.beginPath();
      context.arc(32, 32, 30, 0, Math.PI * 2);
      context.fill();
      context.font = '40px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('🔊', 32, 32); 

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(material);
      sprite.name = "speakingIcon";
      sprite.scale.set(0.8, 0.8, 1);
      sprite.position.set(0, 2.5, 0); 
      targetMesh.add(sprite);
    }
  } else {
    if (existingIcon) {
      targetMesh.remove(existingIcon);
      existingIcon.material.map.dispose();
      existingIcon.material.dispose();
    }
  }
};

const toggleMic = async () => {
  try {
    if (!localAudioTrack.value) {
      // 마이크 트랙 생성 및 게시(Publish)
      localAudioTrack.value = await AgoraRTC.createMicrophoneAudioTrack();
      await agoraClient.value.publish([localAudioTrack.value]);
      isMicOn.value = true;
    } else {
      if (isMicOn.value) {
        await localAudioTrack.value.setEnabled(false);
        isMicOn.value = false;
      } else {
        await localAudioTrack.value.setEnabled(true);
        isMicOn.value = true;
      }
    }
  } catch (error) {
    console.error("마이크 제어 실패:", error);
  }
};

const leaveAgora = async () => {
  if (localAudioTrack.value) {
    localAudioTrack.value.close();
    localAudioTrack.value = null;
  }
  if (agoraClient.value) {
    await agoraClient.value.leave();
    agoraClient.value = null;
  }
};

const toggleMute = () => {
  const video = cinemaVideoRef.value;
  if (video) {
    isMuted.value = !isMuted.value;
    video.muted = isMuted.value;
    if (!isMuted.value) {
      video.volume = 1.0;
      if (isVideoPlaying.value && video.paused) {
         video.play().catch(e => console.log("재생 시도 실패:", e));
      }
    }
  }
};

const checkVideoProgress = async () => {
  const video = cinemaVideoRef.value;
  if (!video || rewardClaimedLocal.value || !auth.currentUser) return;
  if (video.duration > 0 && video.currentTime >= video.duration * 0.95) {
    rewardClaimedLocal.value = true;
    try {
      const claimRewardFunc = httpsCallable(functions, 'claimVideoReward');
      const result = await claimRewardFunc();
      if (result.data.success) {
        showChatBubble(myAvatar, "🎉 영상 시청 완료! 1,000 SaltMate 지급!", "#FFD700"); 
      }
    } catch (error) { console.error(error); }
  }
};

const toggleVideoPlay = () => {
  if (!cinemaVideoRef.value) return;
  const newStatus = !isVideoPlaying.value;
  if (newStatus) cinemaVideoRef.value.play().catch(e => console.log(e));
  else cinemaVideoRef.value.pause();

  update(dbRef(rtdb, plazaVideoPath), {
    isPlaying: newStatus,
    timestamp: Date.now(),
    videoTime: cinemaVideoRef.value.currentTime
  });
};

const syncVideoTime = () => {
  if (!cinemaVideoRef.value) return;
  update(dbRef(rtdb, plazaVideoPath), {
    timestamp: Date.now(),
    videoTime: cinemaVideoRef.value.currentTime,
    forceSync: true
  });
};

const listenToVideoState = () => {
  videoListenerRef = dbRef(rtdb, plazaVideoPath);
  onValue(videoListenerRef, (snapshot) => {
    const data = snapshot.val();
    if (!data || !cinemaVideoRef.value) return;
    isVideoPlaying.value = data.isPlaying;
    const videoEl = cinemaVideoRef.value;
    if (videoEl.readyState === 0) {
      videoEl.addEventListener('loadedmetadata', () => applyVideoState(videoEl, data), { once: true });
      return;
    }
    applyVideoState(videoEl, data);
  });
};

const applyVideoState = (videoEl, data) => {
    if (data.isPlaying) {
      const latency = (Date.now() - data.timestamp) / 1000;
      const targetTime = data.videoTime + latency;
      if (Math.abs(videoEl.currentTime - targetTime) > 1) videoEl.currentTime = targetTime;
      videoEl.play().catch(() => {});
    } else {
      videoEl.pause();
      if (Math.abs(videoEl.currentTime - data.videoTime) > 0.5) videoEl.currentTime = data.videoTime;
    }
};

const handleUserInteraction = () => {
  const video = cinemaVideoRef.value;
  if (video && video.paused) {
      video.play().then(() => { isVideoPlaying.value = true; }).catch(() => {});
  }
};

const loadAnimations = async () => {
  const animationPaths = {
    idle: '/animations/M_Standing_Idle_Variations_008.glb',
    walk: '/animations/F_Walk_003.glb',
    walkBackward: '/animations/M_Walk_Backwards_001.glb',
    strafeLeft: '/animations/M_Walk_Strafe_Left_002.glb',
    strafeRight: '/animations/M_Walk_Strafe_Right_002.glb'
  };
  const loadedAnimations = { idle: null, walk: null, walkBackward: null, strafeLeft: null, strafeRight: null };
  const keys = Object.keys(animationPaths);

  try {
    const gltfResults = await Promise.all(
      Object.values(animationPaths).map(path => loader.loadAsync(path).catch(() => null))
    );
    gltfResults.forEach((gltf, index) => {
      if (gltf && gltf.animations.length > 0) loadedAnimations[keys[index]] = gltf.animations[0];
    });
    return loadedAnimations;
  } catch (error) { return loadedAnimations; }
};

// --- 아바타 로드 ---
const loadAvatar = (url, animations) => {
  return new Promise((resolve) => {
    const model = new THREE.Group();
    model.matrixAutoUpdate = true;
    model.position.set(0, 0, 0);
    model.userData.mixer = null;
    model.userData.actions = {};

    if (!url || !url.endsWith('.glb')) {
      const visuals = new THREE.Group();
      const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
      const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.y = 0.5;
      visuals.add(cube);
      model.add(visuals);
      resolve(model);
      return;
    }

    loader.load(url, (gltf) => {
        const visuals = gltf.scene;
        
        visuals.traverse((child) => {
          if (child.isMesh || child.isSkinnedMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false; // 투명 방지
            child.matrixAutoUpdate = true;
          }
        });

        visuals.scale.set(0.7, 0.7, 0.7);
        const box = new THREE.Box3().setFromObject(visuals);
        visuals.position.y = -box.min.y; 

        model.add(visuals);
        model.userData.visuals = visuals; 

        if (animations) {
          const mixer = new THREE.AnimationMixer(visuals);
          model.userData.mixer = mixer;
          for (const key in animations) {
            if (animations[key]) {
              const action = mixer.clipAction(animations[key]);
              model.userData.actions[key] = action;
              if (key === 'idle') action.play();
            }
          }
          mixer.update(0.01);
        }
        resolve(model);
      }, undefined, (error) => {
        console.error('아바타 로딩 실패:', error);
        resolve(model);
      }
    );
  });
};

const createNicknameSprite = (text) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 300; canvas.height = 100; 
  context.fillStyle = 'rgba(0, 0, 0, 0.5)'; 
  
  const r = 10; const w = 280; const h = 60;
  context.beginPath();
  context.roundRect(10, 20, w, h, r);
  context.fill();

  context.fillStyle = 'white';
  context.font = 'bold 40px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 150, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.5, 0.5, 1); 
  sprite.position.set(0, 0, 0);
  return sprite;
};

const createChatBubbleSprite = (text, textColor = "black") => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = 'bold 30px Arial';
  const textWidth = context.measureText(text).width;
  canvas.width = textWidth + 40; canvas.height = 60;
  
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.roundRect(0, 0, canvas.width, canvas.height, 10);
  context.fill();
  context.stroke();
  
  context.fillStyle = textColor;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width * 0.005, canvas.height * 0.005, 1);
  sprite.position.y = 2.2;
  return sprite;
};

const showChatBubble = (avatar, message, color = "black") => {
  if (!avatar) return;
  if (avatar.activeBubble) {
    avatar.remove(avatar.activeBubble);
    if(avatar.activeBubble.material.map) avatar.activeBubble.material.map.dispose();
    avatar.activeBubble.material.dispose();
    clearTimeout(avatar.activeBubble.timeoutId);
  }
  const newBubble = createChatBubbleSprite(message, color);
  const timeoutId = setTimeout(() => {
    if (avatar.activeBubble === newBubble) {
      avatar.remove(newBubble);
      newBubble.material.dispose();
      avatar.activeBubble = null;
    }
  }, 5000);
  newBubble.timeoutId = timeoutId;
  avatar.activeBubble = newBubble;
  avatar.add(newBubble);
};

// --- Firebase RTDB ---
const joinPlaza = async () => {
  if (!auth.currentUser || !myAvatar) return;
  const currentUid = auth.currentUser.uid;
  playerRef = dbRef(rtdb, `${plazaPlayersPath}/${currentUid}`);
  
  const safeX = myAvatar.position.x || 37.16;
  
  // [핵심 수정] 내 시작 높이를 1.0으로 강제하여 땅 위에서 시작
  const safeY = 1.0; 
  const safeZ = myAvatar.position.z || 7.85;

  const playerData = {
    avatarUrl: myAvatarUrl,
    userName: myUserName,
    position: { x: safeX, y: safeY, z: safeZ },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(),
  };
  try {
    await set(playerRef, playerData);
    await onDisconnect(playerRef).remove();
    isReady.value = true;
  } catch (e) { console.error("입장 실패:", e); }
};

const updateMyStateInRTDB = () => {
  if (!playerRef || !myAvatar || !isReady.value) return;
  update(playerRef, {
    position: {
      x: myAvatar.position.x,
      y: myAvatar.position.y,
      z: myAvatar.position.z,
    },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(),
  }).catch(() => {});
};

let lastUpdateTime = 0;
const throttledUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime > 50) { 
    updateMyStateInRTDB();
    lastUpdateTime = now;
  }
};

const sendMessage = () => {
  if (!chatInput.value.trim()) return;
  push(dbRef(rtdb, plazaChatPath), {
    userId: auth.currentUser.uid,
    userName: myUserName || '익명',
    message: chatInput.value.trim(),
    timestamp: serverTimestamp()
  });
  chatInput.value = '';
};

const listenToChat = () => {
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));
  onChildAdded(chatListenerRef, (snapshot) => {
    const msg = { id: snapshot.key, ...snapshot.val() };
    chatMessages.value.push(msg);
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) { chatMessages.value.shift(); }
    
    nextTick(() => { if (messageListRef.value) { messageListRef.value.scrollTop = messageListRef.value.scrollHeight; } });
    
    const currentUid = auth.currentUser?.uid;
    if (msg.userId === currentUid && myAvatar) {
      showChatBubble(myAvatar, msg.message);
    } else if (otherPlayers[msg.userId] && otherPlayers[msg.userId].mesh) {
      showChatBubble(otherPlayers[msg.userId].mesh, msg.message);
    }
  });
};

// [핵심 수정] listenToOtherPlayers (접속 시 땅속 방지)
const listenToOtherPlayers = (preloadedAnimations) => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  const currentUid = auth.currentUser.uid;
  
  onChildAdded(playersListenerRef, async (snapshot) => {
    if (snapshot.key === currentUid || otherPlayers[snapshot.key]) return;
    const val = snapshot.val();
    
    const posX = isFiniteNumber(val.position?.x) ? val.position.x : 37.16;
    // [수정] DB값이 0이어도, 화면에 그릴 땐 0.5(지면 위)로 보정
    const posYFromDB = isFiniteNumber(val.position?.y) ? val.position.y : 0;
    const posY = Math.max(posYFromDB, 0.5); 
    const posZ = isFiniteNumber(val.position?.z) ? val.position.z : 7.85;
    const rotY = isFiniteNumber(val.rotationY) ? val.rotationY : 0;

    otherPlayers[snapshot.key] = {
      mesh: null, mixer: null, actions: {},
      targetPosition: new THREE.Vector3(posX, posY, posZ),
      targetRotationY: rotY,
      userName: val.userName, isMoving: false
    };
    
    const model = await loadAvatar(val.avatarUrl, preloadedAnimations);
    
    if (scene && otherPlayers[snapshot.key]) {
      if (val.userName !== '익명') {
        const nick = createNicknameSprite(val.userName);
        nick.position.set(0, 1.8, 0); 
        model.add(nick); 
      }

      // [수정] 강제 위치 보정 적용
      model.position.set(posX, posY, posZ);
      model.rotation.y = otherPlayers[snapshot.key].targetRotationY;
      model.visible = true;
      
      scene.add(model);
      
      // [중요] 추가 직후 월드 매트릭스 갱신
      model.updateMatrixWorld(true);
      
      otherPlayers[snapshot.key].mesh = model;
      otherPlayers[snapshot.key].mixer = model.userData.mixer;
      otherPlayers[snapshot.key].actions = model.userData.actions;
      
      if (model.userData.mixer) model.userData.mixer.update(0.01);
      if (model.userData.actions && model.userData.actions.idle) model.userData.actions.idle.play();
    }
  });

  onChildChanged(playersListenerRef, (snap) => {
    if (snap.key === currentUid || !otherPlayers[snap.key]) return;
    const val = snap.val();
    if (!val.position) return;
    
    otherPlayers[snap.key].targetPosition.set(val.position.x, val.position.y, val.position.z);
    otherPlayers[snap.key].targetRotationY = val.rotationY || 0;
  });

  onChildRemoved(playersListenerRef, (snap) => {
    if (!otherPlayers[snap.key]) return;
    if (scene && otherPlayers[snap.key].mesh) scene.remove(otherPlayers[snap.key].mesh);
    delete otherPlayers[snap.key];
  });
};

// --- Three.js Init ---
const initThree = () => {
  try {
      scene = new THREE.Scene();
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load('/my_background.jpg', (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          scene.background = texture;
          scene.environment = texture;
      }, undefined, () => { scene.background = new THREE.Color(0xade6ff); });

      scene.fog = new THREE.Fog(0xaaaaaa, 70, 200);

      const startX = 37.16; const startY = 5.49; const startZ = 7.85;
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(startX, startY + 5, startZ + 10);

      if (!canvasRef.value) return false;
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.minDistance = 2;
      controls.maxDistance = 40;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;
      controls.target.set(startX, startY + 1.0, startZ);
      controls.update();

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(50, 80, 40);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      scene.add(dirLight);
      const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x444444, 0.6);
      scene.add(hemiLight);

      loader.load('/models/low_poly_city_pack.glb', (gltf) => {
          const city = gltf.scene;
          city.name = "cityMap";
          const box = new THREE.Box3().setFromObject(city);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const scaleFactor = 150 / Math.max(size.x, size.z);
          city.scale.set(scaleFactor, scaleFactor, scaleFactor);
          const scaledBox = new THREE.Box3().setFromObject(city);
          const groundLevelY = -scaledBox.min.y;
          city.position.set(-center.x * scaleFactor, groundLevelY, -center.z * scaleFactor);
          
          city.traverse(child => { 
            if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } 
          });
          scene.add(city);

          if (myAvatar) { 
             // [수정] 내 아바타 초기 위치도 안전하게
             myAvatar.position.set(startX, groundLevelY + 0.5, startZ); 
             myAvatar.updateMatrixWorld(true);
          }
          
          const video = cinemaVideoRef.value;
          if (video) {
            const videoTexture = new THREE.VideoTexture(video);
            videoTexture.minFilter = THREE.LinearFilter;
            videoTexture.magFilter = THREE.LinearFilter;
            videoTexture.colorSpace = THREE.SRGBColorSpace; 
            const screenGeo = new THREE.PlaneGeometry(16, 9);
            const screenMat = new THREE.MeshBasicMaterial({ map: videoTexture, side: THREE.DoubleSide, toneMapped: false });
            const screen = new THREE.Mesh(screenGeo, screenMat);
            screen.position.set(startX, groundLevelY + 7, startZ - 15); 
            screen.name = "cinemaScreen";
            scene.add(screen);
          }
      }, undefined, (e) => console.error('맵 로드 실패', e));

      clock = new THREE.Clock();
      return true;
  } catch (e) { console.error(e); return false; }
};

const handleKeyDown = (event) => { if(chatInputRef.value !== document.activeElement) keysPressed[event.code] = true; };
const handleKeyUp = (event) => { keysPressed[event.code] = false; };
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };
const handleResize = () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value || !scene) return;

  let moved = false;
  let moveDirection = { x: 0, z: 0 };
  let currentAnimation = 'idle';
  let currentSpeedFactor = 1.0;

  if (joystickData.value.active && joystickData.value.distance > 10) {
      const targetRotationY = -joystickData.value.angle + Math.PI / 2;
      let currentY = myAvatar.rotation.y; 
      const PI2 = Math.PI * 2;
      let targetY = targetRotationY;
      currentY = (currentY % PI2 + PI2) % PI2; 
      targetY = (targetY % PI2 + PI2) % PI2;
      let diff = targetY - currentY; 
      if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
      myAvatar.rotation.y += diff * deltaTime * 8;

      moveDirection.z = -1; 
      moved = true;
      currentAnimation = 'walk';
      currentSpeedFactor = joystickData.value.force;

  } else if (!joystickData.value.active) { 
    const cameraEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    const isKeyboardMoving = keysPressed['KeyW'] || keysPressed['ArrowUp'] || 
                             keysPressed['KeyS'] || keysPressed['ArrowDown'] || 
                             keysPressed['KeyA'] || keysPressed['ArrowLeft'] || 
                             keysPressed['KeyD'] || keysPressed['ArrowRight'];
    
    if (isKeyboardMoving) {
      myAvatar.rotation.y = cameraEuler.y;
      moved = true;
    }

    if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) { moveDirection.x = 1; currentAnimation = 'strafeLeft'; }
    if (keysPressed['KeyD'] || keysPressed['ArrowRight']) { moveDirection.x = -1; currentAnimation = 'strafeRight'; }
    
    if (keysPressed['KeyW'] || keysPressed['ArrowUp']) { 
        moveDirection.z = 1; 
        if(currentAnimation === 'idle') currentAnimation = 'walk'; 
    }
    if (keysPressed['KeyS'] || keysPressed['ArrowDown']) { 
        moveDirection.z = -1; 
        if(currentAnimation === 'idle') currentAnimation = 'walkBackward'; 
    }
  }

  if (moved) {
    const velocity = new THREE.Vector3(
        moveDirection.x * moveSpeed * currentSpeedFactor * deltaTime, 
        0, 
        moveDirection.z * moveSpeed * currentSpeedFactor * deltaTime
    );
    velocity.applyQuaternion(myAvatar.quaternion);
    myAvatar.position.add(velocity);
    throttledUpdate();
  }

  const boundary = 74.5;
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  
  const cityMap = scene.getObjectByName("cityMap");
  if (cityMap) {
      const raycaster = new THREE.Raycaster();
      raycaster.set(myAvatar.position.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0));
      const intersects = raycaster.intersectObject(cityMap, true);
      if (intersects.length > 0) myAvatar.position.y = intersects[0].point.y;
  }

  const mixer = myAvatar.userData.mixer;
  const actions = myAvatar.userData.actions;
  if (mixer) {
    const targetAction = actions[currentAnimation] || actions.idle;
    const activeAction = mixer._actions.find(a => a.isRunning() && a !== targetAction);
    if (targetAction && !targetAction.isRunning()) {
      targetAction.reset().play();
      if (activeAction) activeAction.crossFadeTo(targetAction, 0.3);
    }
  }
};

const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 15; 

  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    if (!player.mesh) continue;
    
    const distance = player.mesh.position.distanceTo(player.targetPosition);
    const wasMoving = player.isMoving;
    player.isMoving = distance > 0.01;
    
    player.mesh.position.lerp(player.targetPosition, lerpFactor);
    
    let currentY = player.mesh.rotation.y; 
    let targetY = player.targetRotationY; 
    const PI2 = Math.PI * 2;
    currentY = (currentY % PI2 + PI2) % PI2; 
    targetY = (targetY % PI2 + PI2) % PI2;
    let diff = targetY - currentY; 
    if (Math.abs(diff) > Math.PI) { diff = diff > 0 ? diff - PI2 : diff + PI2; }
    player.mesh.rotation.y += diff * lerpFactor;

    player.mesh.updateMatrixWorld(true);

    const mixer = player.mixer;
    const actions = player.actions;
    if (mixer && actions.walk && actions.idle) {
      if (player.isMoving && !wasMoving) { 
          actions.walk.reset().play(); 
          actions.idle.crossFadeTo(actions.walk, 0.2); 
      }
      else if (!player.isMoving && wasMoving) { 
          actions.idle.reset().play(); 
          actions.walk.crossFadeTo(actions.idle, 0.2); 
      }
    }
  }
};

const animate = () => {
  if (!renderer || !scene || !camera || !clock) return;
  requestAnimationFrame(animate);
  const deltaTime = clock.getDelta();

  if (myAvatar && myAvatar.userData.mixer) { myAvatar.userData.mixer.update(deltaTime); }
  for (const userId in otherPlayers) { if (otherPlayers[userId].mixer) { otherPlayers[userId].mixer.update(deltaTime); } }

  updatePlayerMovement(deltaTime);
  updateOtherPlayersMovement(deltaTime);
  if (controls) controls.update();
  renderer.render(scene, camera);
};

onMounted(async () => {
  if (!auth.currentUser) return;
  const currentUid = auth.currentUser.uid;
  
  try {
    const token = await auth.currentUser.getIdTokenResult();
    if (token.claims.role === 'superAdmin') isAdmin.value = true;
  } catch(e) { console.log("권한 확인 실패"); }

  await initAgora();
  if (!initThree()) return;

  const preloadedAnimations = await loadAnimations();
  
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('touchstart', handleUserInteraction); 
  window.addEventListener('click', handleUserInteraction);
  window.addEventListener('mousemove', handleUserInteraction); 

  animate();

  try {
    const userDoc = await getDoc(doc(db, 'users', currentUid));
    if (userDoc.exists()) {
        myAvatarUrl = userDoc.data().avatarUrl;
        myUserName = userDoc.data().name;
        if (userDoc.data().hasReceivedVideoReward) {
          rewardClaimedLocal.value = true;
        }
    }
  } catch (error) {
    console.error("Firestore 정보 가져오기 실패:", error);
  }

  myAvatar = await loadAvatar(myAvatarUrl, preloadedAnimations);
  const startX = 37.16; const startY = 0.5; const startZ = 7.85;
  myAvatar.position.set(startX, startY, startZ); 
  
  if (myUserName) {
    const nick = createNicknameSprite(myUserName);
    nick.position.set(0, 1.8, 0); 
    myAvatar.add(nick);
  }
  scene.add(myAvatar);
  
  myAvatar.visible = true; 
  myAvatar.updateMatrixWorld(true);
  if (myAvatar.userData.mixer) myAvatar.userData.mixer.update(0.01);

  await nextTick();
  const joystickZone = document.getElementById('joystick-zone');
  if (joystickZone) {
      joystickManager = nipplejs.create({ zone: joystickZone, mode: 'static', position: { right: '80px', bottom: '80px' }, color: 'rgba(255, 255, 255, 0.5)', size: 100 });
      joystickManager.on('move', handleJoystickMove);
      joystickManager.on('end', handleJoystickEnd);
  }

  await joinPlaza();
  if (isReady.value) {
    updateMyStateInRTDB(); 
    listenToOtherPlayers(preloadedAnimations); 
    listenToVideoState(); 
    listenToChat(); 
  }
  isLoading.value = false;
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  window.removeEventListener('touchstart', handleUserInteraction);
  window.removeEventListener('click', handleUserInteraction);
  window.removeEventListener('mousemove', handleUserInteraction);
  
  leaveAgora(); 

  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);
  if (videoListenerRef) off(videoListenerRef);
  if (playerRef) remove(playerRef);
  
  if (joystickManager) joystickManager.destroy();
  if (controls) controls.dispose();
  if (renderer) renderer.dispose();
});
</script>

<style scoped>
/* 모바일 주소창 고려한 높이 설정 */
.utopia-container { 
  width: 100vw; 
  height: 100dvh; 
  margin: 0; 
  padding: 0; 
  overflow: hidden; 
  position: relative; 
  background-color: #ade6ff; 
}
.main-canvas { display: block; width: 100%; height: 100%; }
.loading-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.8); color: white; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; }
.spinner { border: 4px solid rgba(255, 255, 255, 0.3); width: 40px; height: 40px; border-radius: 50%; border-left-color: #fff; animation: spin 1s linear infinite; margin-bottom: 20px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.chat-ui { 
  position: absolute; 
  bottom: 20px; 
  left: 20px; 
  width: 300px; 
  max-width: 80%; 
  max-height: 20vh; 
  background-color: rgba(0, 0, 0, 0.7); 
  border-radius: 8px; 
  padding: 10px; 
  display: flex; 
  flex-direction: column; 
  z-index: 5; 
}
.message-list { flex-grow: 1; overflow-y: auto; margin-bottom: 10px; color: white; font-size: 0.9em; }
.chat-message { margin-bottom: 6px; word-break: break-all; line-height: 1.4; }
.chat-ui input { width: 100%; padding: 10px; border: none; border-radius: 4px; background-color: rgba(255, 255, 255, 0.15); color: white; outline: none; }

.joystick-zone { position: absolute; bottom: 30px; right: 30px; width: 150px; height: 150px; z-index: 6; opacity: 0.7; }

.user-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 100;
  display: flex;
  gap: 8px;
}
.user-controls button {
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 20px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.85rem;
  transition: background 0.3s;
  white-space: nowrap;
}
.user-controls button:hover {
  background: rgba(0, 0, 0, 0.8);
}
.user-controls button.active {
  border-color: #28a745;
  color: #28a745;
}

.admin-video-controls { 
  position: absolute; 
  top: 60px; 
  right: 10px;
  background: rgba(0, 0, 0, 0.8); 
  padding: 10px; 
  border-radius: 8px; 
  color: white; 
  z-index: 100; 
  width: 150px;
}
.admin-video-controls h3 { margin: 0 0 8px 0; font-size: 0.9rem; text-align: center; }
.admin-buttons { display: flex; gap: 5px; }
.admin-buttons button { flex: 1; padding: 6px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
.admin-buttons button:hover { background: #0056b3; }

@media (max-width: 768px) {
  .chat-ui {
    bottom: 80px; 
    width: 60%;
    font-size: 0.8rem;
  }
  .user-controls {
    top: 10px;
    right: 10px;
  }
  .user-controls button {
    padding: 6px 10px;
    font-size: 0.75rem;
  }
  .joystick-zone {
    bottom: 20px;
    right: 20px;
    width: 120px;
    height: 120px;
  }
}
</style>