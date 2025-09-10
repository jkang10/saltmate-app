<template>
  <div class="management-container">
    <h3><i class="fas fa-satellite-dish"></i> 실시간 공지 관리</h3>
    <p>사용자 대시보드 상단에 노출될 실시간 공지 메시지를 관리합니다.</p>

    <div class="notice-form card">
      <h4>새 공지 작성</h4>
      <form @submit.prevent="saveAnnouncement">
        <div class="form-group">
          <label for="notice-message">공지 메시지</label>
          <input type="text" id="notice-message" v-model="newAnnouncement.message" placeholder="예: 서버 점검 예정입니다 (자정 ~ 오전 1시)" required />
        </div>
        <div class="form-group">
          <label for="notice-link">연결 링크 (선택 사항)</label>
          <input type="text" id="notice-link" v-model="newAnnouncement.link" placeholder="예: /community/post/POST_ID" />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
          <span v-if="isSubmitting">저장 중...</span>
          <span v-else>공지 저장</span>
        </button>
      </form>
    </div>

    <div class="post-list card">
      <h4>공지 목록</h4>
      <div v-if="isLoading" class="loading-spinner"></div>
      <table v-else-if="announcements.length > 0" class="post-table">
        <thead>
          <tr>
            <th>활성 상태</th>
            <th>메시지</th>
            <th>링크</th>
            <th>생성일</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="announcement in announcements" :key="announcement.id">
            <td>
              <label class="switch">
                <input type="checkbox" :checked="announcement.isActive" @change="toggleActive(announcement)">
                <span class="slider round"></span>
              </label>
            </td>
            <td>{{ announcement.message }}</td>
            <td>{{ announcement.link || '없음' }}</td>
            <td>{{ formatDate(announcement.createdAt) }}</td>
            <td>
              <button @click="deleteAnnouncement(announcement.id)" class="btn btn-sm btn-outline-danger">
                삭제
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">생성된 공지가 없습니다.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { db } from "@/firebaseConfig";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
  updateDoc,
  writeBatch
} from "firebase/firestore";

const announcements = ref([]);
const isLoading = ref(true);
const isSubmitting = ref(false);
const newAnnouncement = reactive({ message: "", link: "" });

let unsubscribe = null;

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  return timestamp.toDate().toLocaleString("ko-KR");
};

const fetchAnnouncements = () => {
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  unsubscribe = onSnapshot(q, (snapshot) => {
    announcements.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    isLoading.value = false;
  });
};

const saveAnnouncement = async () => {
  if (!newAnnouncement.message.trim()) {
    alert("공지 메시지를 입력해주세요.");
    return;
  }
  isSubmitting.value = true;
  try {
    await addDoc(collection(db, "announcements"), {
      message: newAnnouncement.message,
      link: newAnnouncement.link || null,
      isActive: false,
      createdAt: serverTimestamp(),
    });
    newAnnouncement.message = "";
    newAnnouncement.link = "";
  } catch (error) {
    console.error("공지 저장 오류:", error);
    alert("공지 저장에 실패했습니다.");
  } finally {
    isSubmitting.value = false;
  }
};

const toggleActive = async (announcement) => {
  const newStatus = !announcement.isActive;
  try {
    const batch = writeBatch(db);
    // 새로 활성화하는 공지가 있다면, 다른 모든 공지는 비활성화 처리
    if (newStatus) {
      announcements.value.forEach(ann => {
        if (ann.isActive) {
          const docRef = doc(db, "announcements", ann.id);
          batch.update(docRef, { isActive: false });
        }
      });
    }
    const targetDocRef = doc(db, "announcements", announcement.id);
    batch.update(targetDocRef, { isActive: newStatus });
    await batch.commit();
  } catch (error) {
    console.error("상태 변경 오류:", error);
    alert("상태 변경에 실패했습니다.");
  }
};

const deleteAnnouncement = async (id) => {
  if (!confirm("정말로 이 공지를 삭제하시겠습니까?")) return;
  try {
    await deleteDoc(doc(db, "announcements", id));
  } catch (error) {
    console.error("공지 삭제 오류:", error);
    alert("공지 삭제에 실패했습니다.");
  }
};

onMounted(() => {
  fetchAnnouncements();
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
/* NoticesCommunityManagement.vue와 유사한 스타일 사용 */
.management-container { display: flex; flex-direction: column; gap: 20px; }
.card { background-color: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; margin-bottom: 8px; font-weight: 600; }
.form-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1em; box-sizing: border-box; }
.post-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
.post-table th, .post-table td { border-bottom: 1px solid #eee; padding: 12px 15px; text-align: left; vertical-align: middle; }
.post-table th { background-color: #f8f9fa; }
.btn { border: none; border-radius: 8px; padding: 12px 25px; cursor: pointer; font-weight: bold; transition: background-color 0.3s; }
.btn-primary { background-color: #007bff; color: white; }
.btn-outline-danger { background-color: transparent; border: 1px solid #dc3545; color: #dc3545; }
.btn-sm { padding: 5px 10px; font-size: 0.85em; }
.loading-spinner, .no-data { text-align: center; padding: 50px; color: #777; }

/* 토글 스위치 스타일 */
.switch { position: relative; display: inline-block; width: 60px; height: 34px; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; }
.slider:before { position: absolute; content: ""; height: 26px; width: 26px; left: 4px; bottom: 4px; background-color: white; transition: .4s; }
input:checked + .slider { background-color: #28a745; }
input:checked + .slider:before { transform: translateX(26px); }
.slider.round { border-radius: 34px; }
.slider.round:before { border-radius: 50%; }
</style>
