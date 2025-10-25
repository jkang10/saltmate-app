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
  set, onDisconnect, push, serverTimestamp, off, query, limitToLast, remove
} from 'firebase/database';
import nipplejs from 'nipplejs';

// --- State Variables ---
const canvasRef = ref(null);
const isLoading = ref(true);
const loadingMessage = ref('유토피아 입장 준비 중...');
const isReady = ref(false);

// --- Avatar ---
let myAvatar = null;
const otherPlayers = reactive({});
let myAvatarUrl = '';
let myUserName = '';

// --- Chat ---
const chatInput = ref('');
const chatMessages = ref([]);
const messageListRef = ref(null);
const chatInputRef = ref(null); // Ref for chat input element
const MAX_CHAT_MESSAGES = 50;

// --- Three.js ---
let scene, camera, renderer, clock;
const loader = new GLTFLoader();

// --- Firebase RTDB Paths ---
const plazaPlayersPath = 'plazaPlayers';
const plazaChatPath = 'plazaChat';
let playerRef = null;
let playersListenerRef = null;
let chatListenerRef = null;

// --- Player Movement ---
const moveSpeed = 2.0;
const rotateSpeed = Math.PI;
const keysPressed = reactive({});
const joystickData = ref({ active: false, angle: 0, distance: 0, force: 0 });
let joystickManager = null;

// --- Helper: Load Avatar ---
const loadAvatar = (url) => {
  return new Promise((resolve) => {
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
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.y = 0.5;
        resolve(cube);
      }
    );
  });
};

// --- Firebase RTDB Functions ---
// Join the plaza: set initial data and onDisconnect handler
const joinPlaza = async () => {
  if (!auth.currentUser || !myAvatar) {
      console.error("Cannot join plaza: User not logged in or avatar not loaded.");
      return;
  }
  const uid = auth.currentUser.uid; // Use uid consistently
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
    await onDisconnect(playerRef).remove(); // Remove player data when disconnected
    console.log('Plaza joined successfully');
    isReady.value = true; // Enable movement and chat
  } catch (error) {
    console.error("Failed to join Plaza:", error);
    isLoading.value = true; // Keep loading state on failure
    loadingMessage.value = "입장에 실패했습니다.";
  }
};

// Update my state (position, rotation) in RTDB
const updateMyStateInRTDB = () => {
  if (!playerRef || !myAvatar || !isReady.value) return;

  const newState = {
    position: { x: myAvatar.position.x, y: myAvatar.position.y, z: myAvatar.position.z },
    rotationY: myAvatar.rotation.y,
    timestamp: serverTimestamp(),
  };
  // Use set to update, ensuring avatarUrl and userName are preserved
  set(playerRef, { ...newState, avatarUrl: myAvatarUrl, userName: myUserName });
};

// Throttle updates to RTDB to avoid excessive writes
let lastUpdateTime = 0;
const updateInterval = 100; // ms interval for updates

const throttledUpdate = () => {
  const now = Date.now();
  if (now - lastUpdateTime > updateInterval) {
    updateMyStateInRTDB();
    lastUpdateTime = now;
  }
};

// Listen for other players joining, leaving, or updating state
const listenToOtherPlayers = () => {
  playersListenerRef = dbRef(rtdb, plazaPlayersPath);
  const currentUid = auth.currentUser.uid; // Correct variable name

  // Player added
  onChildAdded(playersListenerRef, async (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || otherPlayers[userId]) return; // Skip self or already added

    const playerData = snapshot.val();
    loadingMessage.value = `플레이어 ${playerData.userName || userId} 로딩 중...`;
    // isLoading.value = true; // Avoid showing loading for every joining player

    try {
      const avatarMesh = await loadAvatar(playerData.avatarUrl);
      if (scene) { // Check if scene still exists (component might unmount quickly)
          scene.add(avatarMesh);
          avatarMesh.position.set(playerData.position.x, playerData.position.y, playerData.position.z);
          avatarMesh.rotation.y = playerData.rotationY;

          otherPlayers[userId] = {
            mesh: avatarMesh,
            targetPosition: new THREE.Vector3().copy(avatarMesh.position),
            targetRotationY: avatarMesh.rotation.y,
          };
          console.log(`${playerData.userName || userId} joined`);
      }
    } catch (error) {
      console.error(`Failed to load avatar for player ${userId}:`, error);
    } finally {
        // isLoading.value = false; // Set loading false after handling
    }
  });

  // Player state changed (position/rotation)
  onChildChanged(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return;

    const playerData = snapshot.val();
    const player = otherPlayers[userId];

    // Update target state for smooth interpolation in animation loop
    player.targetPosition.set(playerData.position.x, playerData.position.y, playerData.position.z);
    player.targetRotationY = playerData.rotationY;
  });

  // Player removed
  onChildRemoved(playersListenerRef, (snapshot) => {
    const userId = snapshot.key;
    if (userId === currentUid || !otherPlayers[userId]) return;

    const playerToRemove = otherPlayers[userId];
    if (scene) { // Check if scene exists
        scene.remove(playerToRemove.mesh);
    }

    // Dispose Three.js resources
    playerToRemove.mesh.traverse(child => {
       if (child.isMesh) {
           if (child.geometry) child.geometry.dispose();
           if (child.material) {
               if (Array.isArray(child.material)) {
                   child.material.forEach(m => {
                       if (m.map) m.map.dispose();
                       // Dispose other textures if needed (normalMap, etc.)
                       m.dispose();
                   });
               } else {
                   if (child.material.map) child.material.map.dispose();
                   // Dispose other textures
                   child.material.dispose();
               }
           }
       }
    });

    delete otherPlayers[userId];
    console.log(`Player ${userId} left`);
  });
};

// --- Chat Functions ---
// Send a chat message
const sendMessage = () => {
  if (!chatInput.value.trim() || !isReady.value || !auth.currentUser) return;

  const chatMessage = {
    userId: auth.currentUser.uid,
    userName: myUserName || '익명',
    message: chatInput.value.trim(),
    timestamp: serverTimestamp(),
  };

  push(dbRef(rtdb, plazaChatPath), chatMessage);
  chatInput.value = ''; // Clear input field
};

// Listen for new chat messages
const listenToChat = () => {
  // Get reference to the last MAX_CHAT_MESSAGES
  chatListenerRef = query(dbRef(rtdb, plazaChatPath), limitToLast(MAX_CHAT_MESSAGES));

  onChildAdded(chatListenerRef, (snapshot) => {
    chatMessages.value.push({ id: snapshot.key, ...snapshot.val() });
    // Keep message list trimmed
    if (chatMessages.value.length > MAX_CHAT_MESSAGES) {
      chatMessages.value.shift();
    }
    // Auto-scroll to the bottom
    nextTick(() => {
      if (messageListRef.value) {
        messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
      }
    });
  });
};


// --- Three.js Initialization ---
const initThree = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xade6ff);
  scene.fog = new THREE.Fog(0xade6ff, 10, 30);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 4);

  if (canvasRef.value) {
      renderer = new THREE.WebGLRenderer({ canvas: canvasRef.value, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } else {
      console.error("Canvas element not found!");
      return;
  }

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 15, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 0.5; dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -15; dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 15; dirLight.shadow.camera.bottom = -15;
  scene.add(dirLight);
  const hemiLight = new THREE.HemisphereLight(0xade6ff, 0x99cc99, 0.5);
  scene.add(hemiLight);

  // Ground
  const groundGeometry = new THREE.PlaneGeometry(30, 30);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x88bb88, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const gridHelper = new THREE.GridHelper(30, 30, 0xcccccc, 0xcccccc);
  scene.add(gridHelper);

  clock = new THREE.Clock(); // Initialize clock
};

// --- Player Movement Logic ---
// Keyboard event handlers
const handleKeyDown = (event) => {
    // Ignore keys if chat input is focused
    if (chatInputRef.value === document.activeElement) return;
    keysPressed[event.key.toLowerCase()] = true;
    // console.log("Key Down:", event.key, keysPressed); // Debug log
};
const handleKeyUp = (event) => {
    keysPressed[event.key.toLowerCase()] = false;
    // console.log("Key Up:", event.key, keysPressed); // Debug log
};
// Joystick event handlers
const handleJoystickMove = (evt, data) => { joystickData.value = { active: true, angle: data.angle.radian, distance: data.distance, force: data.force }; };
const handleJoystickEnd = () => { joystickData.value = { active: false, angle: 0, distance: 0, force: 0 }; };

// Update my avatar's position and rotation based on input
const updatePlayerMovement = (deltaTime) => {
  if (!myAvatar || !isReady.value) return;

  let moved = false; // Flag to check if position/rotation changed
  let moveDirection = new THREE.Vector3(0, 0, 0); // Local direction vector
  let targetRotationY = myAvatar.rotation.y;     // Target rotation for lerping
  let applyRotation = false;                     // Should rotation be applied?
  let applyMovement = false;                     // Should movement be applied?
  let currentSpeedFactor = 1.0;                  // Speed multiplier (for joystick force)

  // --- Process Joystick Input ---
  if (joystickData.value.active) {
    // Calculate target rotation based on joystick angle
    // NippleJS angle: 0 is right, PI/2 is up, PI is left, 3*PI/2 is down
    // Three.js Y rotation: 0 is +Z, PI/2 is -X, PI is -Z, 3*PI/2 is +X
    // Adjusting NippleJS angle to Three.js Y rotation (may need tweaking based on model orientation)
    targetRotationY = -joystickData.value.angle + Math.PI / 2;

    moveDirection.z = -1; // Joystick always moves forward relative to its direction
    currentSpeedFactor = joystickData.value.force; // Speed based on how far joystick is pushed
    applyRotation = true;
    applyMovement = joystickData.value.distance > 10; // Only move if joystick moved significantly
  }
  // --- Process Keyboard Input ---
  else {
    // Rotation keys (A/D or Left/Right arrows)
    if (keysPressed['a'] || keysPressed['arrowleft']) {
      targetRotationY += rotateSpeed * deltaTime; // Increment target angle
      applyRotation = true;
    }
    if (keysPressed['d'] || keysPressed['arrowright']) {
      targetRotationY -= rotateSpeed * deltaTime; // Decrement target angle
      applyRotation = true;
    }
    // Movement keys (W/S or Up/Down arrows) - Forward/Backward along Z-axis
    if (keysPressed['w'] || keysPressed['arrowup']) {
      moveDirection.z = -1; // Move forward (-Z direction)
      applyMovement = true;
    }
    if (keysPressed['s'] || keysPressed['arrowdown']) {
      moveDirection.z = 1;  // Move backward (+Z direction)
      applyMovement = true;
    }
  }

  // --- Apply Rotation (Smooth Lerp) ---
  if (applyRotation) {
    let currentY = myAvatar.rotation.y;
    const PI2 = Math.PI * 2;
    // Normalize angles to [0, 2PI)
    currentY = (currentY % PI2 + PI2) % PI2;
    targetRotationY = (targetRotationY % PI2 + PI2) % PI2;

    // Calculate shortest angle difference
    let diff = targetRotationY - currentY;
    if (Math.abs(diff) > Math.PI) {
      diff = diff > 0 ? diff - PI2 : diff + PI2;
    }

    // Apply lerped rotation change
    const rotationChange = diff * deltaTime * 8; // Adjust multiplier for rotation speed
    myAvatar.rotation.y += rotationChange;
    // Check if rotation actually happened (avoid tiny updates)
    if (Math.abs(rotationChange) > 0.001) moved = true;
  }

  // --- Apply Movement ---
  if (applyMovement) {
    const moveAmount = moveDirection.z * moveSpeed * currentSpeedFactor * deltaTime;
    myAvatar.translateZ(moveAmount); // Move along the local Z-axis
    // Check if movement actually happened
    if (Math.abs(moveAmount) > 0.001) moved = true;
  }

  // --- Boundary Check ---
  const boundary = 14.5; // Adjust based on ground size
  myAvatar.position.x = Math.max(-boundary, Math.min(boundary, myAvatar.position.x));
  myAvatar.position.z = Math.max(-boundary, Math.min(boundary, myAvatar.position.z));
  myAvatar.position.y = 0; // Keep avatar on the ground

  // --- Update RTDB if state changed ---
  if (moved) { // Only update if actual movement or significant rotation occurred
    throttledUpdate();
  }
};

// --- Update Other Players' Movement (Smooth Interpolation) ---
const updateOtherPlayersMovement = (deltaTime) => {
  const lerpFactor = deltaTime * 8; // Interpolation speed
  for (const userId in otherPlayers) {
    const player = otherPlayers[userId];
    const mesh = player.mesh;

    // Position Lerp
    mesh.position.lerp(player.targetPosition, lerpFactor);

    // Rotation Lerp (Y-axis only, shortest angle)
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
    // Force reset other rotations (prevent tilting)
    mesh.rotation.x = 0;
    mesh.rotation.z = 0;
  }
};

// --- Animation Loop ---
const animate = () => {
  if (!renderer || !scene || !camera || !clock) return; // Exit if component unmounted
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta(); // Time since last frame

  updatePlayerMovement(deltaTime);     // Update my avatar's movement
  updateOtherPlayersMovement(deltaTime); // Update other avatars' movements

  // Simple camera follow logic
  if (myAvatar) {
      const offset = new THREE.Vector3(0, 2.5, 4.5); // Offset from avatar (behind and slightly above)
      // Apply avatar's rotation to the offset vector
      offset.applyQuaternion(myAvatar.quaternion);
      const targetCameraPosition = myAvatar.position.clone().add(offset);
      // Smoothly move camera towards the target position
      camera.position.lerp(targetCameraPosition, deltaTime * 2.0);
      // Make camera look at the avatar's upper body
      camera.lookAt(myAvatar.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
  }

  renderer.render(scene, camera); // Render the scene
};

// --- Window Resize Handler ---
const handleResize = () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

// --- Component Lifecycle Hooks ---
onMounted(async () => {
  if (!auth.currentUser) {
    console.error("User not logged in.");
    loadingMessage.value = "로그인이 필요합니다.";
    isLoading.value = false;
    // Optionally redirect to login page here
    return;
  }
  const currentUid = auth.currentUser.uid; // Correct variable name

  // 1. Initialize Three.js environment
  initThree();
  if (!scene || !renderer || !clock) { // Check if initialization failed
      loadingMessage.value = "3D 환경 초기화 실패.";
      isLoading.value = false;
      return;
  }

  // 2. Add event listeners
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  animate(); // Start the animation loop

  // 3. Fetch user data from Firestore
  loadingMessage.value = '내 정보 로딩 중...';
  try {
    const userDoc = await getDoc(doc(db, 'users', currentUid)); // Use db
    if (userDoc.exists()) {
      myAvatarUrl = userDoc.data().avatarUrl || '';
      myUserName = userDoc.data().name || '익명';
    } else {
      console.error("User document not found in Firestore!");
      myUserName = '익명'; // Set default name
    }
  } catch (error) {
    console.error("Firestore user fetch failed:", error);
    loadingMessage.value = '내 정보 로딩 실패.';
    isLoading.value = false;
    return;
  }

  // 4. Load my avatar model
  loadingMessage.value = '내 아바타 로딩 중...';
  try {
    myAvatar = await loadAvatar(myAvatarUrl);
    scene.add(myAvatar);
    camera.lookAt(myAvatar.position); // Initial camera lookAt
  } catch (error) {
    // Error handled inside loadAvatar, which resolves with a default cube
    loadingMessage.value = '아바타 로딩 중 오류 발생. 기본 아바타로 시작합니다.';
    if (myAvatar) { // If default cube was resolved
        scene.add(myAvatar);
    } else { // Should not happen if loadAvatar always resolves
        console.error("Failed to load even the default avatar.");
        isLoading.value = false;
        return;
    }
  }

   // 5. Initialize Joystick
  const joystickZone = document.getElementById('joystick-zone');
  if (joystickZone) {
    try {
        joystickManager = nipplejs.create({
          zone: joystickZone,
          mode: 'static',
          position: { right: '80px', bottom: '80px' },
          color: 'rgba(255, 255, 255, 0.5)',
          size: 100
        });
        joystickManager.on('move', handleJoystickMove);
        joystickManager.on('end', handleJoystickEnd);
    } catch (e) { console.error("Failed to create joystick:", e); }
  } else { console.warn("Joystick zone element not found."); }


  // 6. Connect to RTDB and start listeners
  loadingMessage.value = '다른 플레이어 접속 중...';
  await joinPlaza(); // Sets isReady.value = true on success
  if(isReady.value){ // Only start listeners if join was successful
      listenToOtherPlayers();
      listenToChat();
  } else {
      // Handle failed join (e.g., keep loading message)
      loadingMessage.value = 'Plaza 연결 실패.';
      // isLoading.value = false; // Optionally stop loading indicator
      return; // Stop further execution if join failed
  }
  isLoading.value = false; // All setup complete
});

onUnmounted(() => {
  // Remove event listeners
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);

  // Remove RTDB listeners
  if (playersListenerRef) off(playersListenerRef);
  if (chatListenerRef) off(chatListenerRef);

  // Remove my player data from RTDB (as backup for onDisconnect)
  if (playerRef) remove(playerRef);

  // Destroy joystick
  if (joystickManager) {
    joystickManager.off('move', handleJoystickMove);
    joystickManager.off('end', handleJoystickEnd);
    joystickManager.destroy();
    joystickManager = null;
  }

  // Clean up Three.js resources
  if (renderer) { renderer.dispose(); renderer = null; }
  if (scene) {
     scene.traverse(object => {
       // Check if it's a mesh with geometry and material
       if(object.isMesh && object.geometry && object.material) {
           object.geometry.dispose(); // Dispose geometry
           // Dispose material(s)
           if (Array.isArray(object.material)) {
               object.material.forEach(m => {
                   if(m.map) m.map.dispose(); // Dispose texture map
                   // Dispose other maps (normalMap, bumpMap, etc.) if they exist
                   m.dispose(); // Dispose material itself
               });
           } else {
               if(object.material.map) object.material.map.dispose();
               // Dispose other maps
               object.material.dispose();
           }
       }
     });
    scene = null; // Remove scene reference
  }
  // Clear references
  camera = null; clock = null; myAvatar = null;
  // Clear other players reactive object
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
  background-color: #ade6ff; /* Background color in case canvas fails */
}
.main-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8); /* Darker overlay */
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
  font-size: 1.1em;
}
.spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  width: 40px; /* Larger spinner */
  height: 40px;
  border-radius: 50%;
  border-left-color: #fff;
  animation: spin 1s linear infinite; /* Faster spin */
  margin-bottom: 20px;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.chat-ui {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 300px;
  max-width: 80%; /* Limit width on smaller screens */
  max-height: 40%;
  background-color: rgba(0, 0, 0, 0.7); /* Slightly more transparent */
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  z-index: 5;
  box-shadow: 0 2px 10px rgba(0,0,0,0.5); /* Add shadow */
}
.message-list {
  flex-grow: 1;
  overflow-y: auto;
  margin-bottom: 10px;
  color: white;
  font-size: 0.9em;
  scrollbar-width: thin; /* Firefox scrollbar */
  scrollbar-color: rgba(255,255,255,0.3) rgba(0,0,0,0.5); /* Firefox scrollbar */
}
/* Webkit scrollbar styling */
.message-list::-webkit-scrollbar { width: 5px; }
.message-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.5); border-radius: 3px;}
.message-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px;}
.message-list::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.5); }

.chat-message {
  margin-bottom: 6px; /* Slightly more spacing */
  word-break: break-all;
  line-height: 1.4;
}
.chat-message strong {
  color: #f1c40f;
  margin-right: 5px;
}
.chat-ui input {
  width: 100%;
  padding: 10px; /* More padding */
  border: none;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.15); /* Slightly less transparent */
  color: white;
  outline: none;
  font-size: 0.9em;
  box-sizing: border-box; /* Ensure padding doesn't increase size */
}
.chat-ui input::placeholder { color: rgba(255, 255, 255, 0.6); }
.chat-ui input:disabled { background-color: rgba(255, 255, 255, 0.1); cursor: not-allowed; }
.joystick-zone {
  position: absolute;
  bottom: 30px;
  right: 30px; /* Bottom right */
  width: 150px;
  height: 150px;
  z-index: 6;
  opacity: 0.7; /* Make it slightly transparent */
}
</style>
