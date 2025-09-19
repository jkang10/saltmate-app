<template>
  <div class="management-container">
    <h3><i class="fas fa-map-marker-alt"></i> 지역(센터) 관리</h3>
    <p>회원가입 시 선택할 수 있는 지역(센터) 목록을 관리하고, 방문 인증 QR코드를 생성합니다.</p>

    <div class="form-card card">
      <h4>새 센터 추가</h4>
      <form @submit.prevent="addCenter" class="center-form">
        <input v-model="newCenterName" placeholder="센터 이름 (예: 서울센터)" required />
        <button type="submit" class="btn btn-primary">추가</button>
      </form>
    </div>

    <div class="list-card card">
      <h4>센터 목록</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <ul v-else-if="centers.length > 0" class="center-list">
        <li v-for="center in centers" :key="center.id">
          <span>{{ center.name }}</span>
          <div class="actions">
            <button @click="generateQR(center.id)" class="btn btn-sm btn-info">
              QR 생성
            </button>
            <button @click="deleteCenter(center.id)" class="btn btn-sm btn-danger">
              삭제
            </button>
          </div>
        </li>
      </ul>
      <p v-else class="no-data">등록된 센터가 없습니다.</p>
    </div>

    <div v-if="qrModal.visible" class="modal-overlay" @click.self="closeQrModal">
      <div class="modal-content">
        <header class="modal-header">
          <h3>방문 인증 QR코드</h3>
          <button @click="closeQrModal" class="close-button">&times;</button>
        </header>
        <div class="modal-body">
          <p v-if="qrModal.isLoading">QR코드를 생성 중입니다...</p>
	<div v-else-if="qrModal.qrValue" class="qr-code-container">
	  <qrcode-vue :value="qrModal.qrValue" :size="250" level="H" />
	  <p class="qr-info">이 QR코드는 5분간 유효하며, 1회만 사용할 수 있습니다.</p>
	</div>
           <p v-else class="qr-error">{{ qrModal.error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from "vue";
import { db, functions } from "@/firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from "firebase/firestore";
import QrcodeVue from 'qrcode.vue'; // QR코드 생성 라이브러리

export default {
  name: "CenterManagement",
  components: {
    QrcodeVue, // 컴포넌트 등록
  },
	setup() {
	  const centers = ref([]);
	  const newCenterName = ref("");
	  const loading = ref(true);
	  const qrModal = reactive({
	    visible: false,
	    isLoading: false,
	    qrValue: null, // [수정] qrId -> qrValue 로 이름 변경
	    error: null,
	  });

    const fetchCenters = async () => {
      loading.value = true;
      try {
        const q = query(collection(db, "centers"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        centers.value = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      } catch (error) { console.error("센터 목록 로딩 오류:", error); } 
      finally { loading.value = false; }
    };

    const addCenter = async () => {
      if (!newCenterName.value.trim()) return;
      try {
        await addDoc(collection(db, "centers"), { name: newCenterName.value, createdAt: serverTimestamp() });
        newCenterName.value = "";
        await fetchCenters();
      } catch (error) { console.error("센터 추가 오류:", error); }
    };

    const deleteCenter = async (id) => {
      if (!confirm("정말로 이 센터를 삭제하시겠습니까?")) return;
      try {
        await deleteDoc(doc(db, "centers", id));
        await fetchCenters();
      } catch (error) { console.error("센터 삭제 오류:", error); }
    };

     const generateQR = async (centerId) => {
    qrModal.visible = true;
    qrModal.isLoading = true;
    qrModal.qrValue = null;
    qrModal.error = null;
    try {
      const generateFunc = httpsCallable(functions, "generateCenterQRCode");
      const result = await generateFunc({ centerId });
      if (result.data.success) {
        // [핵심 수정] 단순 ID가 아닌, 전체 URL을 QR코드 값으로 생성합니다.
        const baseUrl = window.location.origin; // https://saltmate-app.netlify.app
        qrModal.qrValue = `${baseUrl}/qr-scanner?qrId=${result.data.qrId}`;
      } else {
        throw new Error("QR코드 생성에 실패했습니다.");
      }
    } catch (error) {
      console.error("QR코드 생성 오류:", error);
      qrModal.error = error.message;
    } finally {
      qrModal.isLoading = false;
    }
  };
  
  const closeQrModal = () => {
    qrModal.visible = false;
  };

  onMounted(fetchCenters);

  return { centers, newCenterName, loading, addCenter, deleteCenter, qrModal, generateQR, closeQrModal };
},
</script>

<style scoped>
.actions { display: flex; gap: 10px; }
.btn-info { background-color: #17a2b8; color: white; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 20px; border-radius: 12px; width: 90%; max-width: 400px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
.modal-header h3 { margin: 0; }
.close-button { background: none; border: none; font-size: 1.5em; cursor: pointer; }
.modal-body { text-align: center; }
.qr-code-container { display: flex; flex-direction: column; align-items: center; gap: 15px; }
.qr-info { font-size: 0.9em; color: #555; }
.qr-error { color: #dc3545; }
/* (기존 스타일 유지) */
.management-container { display: flex; flex-direction: column; gap: 20px; }
.card { background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.center-form { display: flex; gap: 10px; }
.center-form input { flex-grow: 1; padding: 10px 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 1em; }
.center-list { list-style: none; padding: 0; margin: 0; }
.center-list li { display: flex; justify-content: space-between; align-items: center; padding: 12px 5px; border-bottom: 1px solid #f0f0f0; }
.center-list li:last-child { border-bottom: none; }
.no-data, .loading-spinner { text-align: center; padding: 40px; color: #888; }
.btn { border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
.btn-primary { background-color: #007bff; color: white; }
.btn-danger { background-color: #dc3545; color: white; }
.btn-sm { padding: 5px 10px; font-size: 0.85em; }
</style>