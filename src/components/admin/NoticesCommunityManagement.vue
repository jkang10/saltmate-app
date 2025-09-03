<template>
  <div class="management-container">
    <h3><i class="fas fa-bullhorn"></i> 공지사항 및 알림 관리</h3>
    <p>새로운 공지사항을 작성하고, 사용자에게 알림을 보내거나 게시글을 관리합니다.</p>

    <div class="tabs">
      <button class="tab-button" :class="{ active: activeTab === 'notice' }" @click="activeTab = 'notice'">
        공지사항 작성
      </button>
      <button class="tab-button" :class="{ active: activeTab === 'notification' }" @click="activeTab = 'notification'">
        알림 발송
      </button>
    </div>

    <div v-if="activeTab === 'notice'" class="notice-form card">
      <h4>새 공지사항 작성</h4>
      <p class="description">공지사항을 작성하면 '공지' 유형으로 게시글 목록에 추가됩니다.</p>
      <form @submit.prevent="createNotice">
        <div class="form-group">
          <label for="notice-title">제목</label>
          <input type="text" id="notice-title" v-model="newNotice.title" placeholder="공지사항 제목을 입력하세요" required />
        </div>
        <div class="form-group">
          <label for="notice-content">내용</label>
          <textarea id="notice-content" v-model="newNotice.content" rows="5" placeholder="공지사항 내용을 입력하세요" required></textarea>
        </div>
        <button type="submit" class="btn btn-primary" :disabled="isSubmittingNotice">
          <span v-if="isSubmittingNotice">등록 중...</span>
          <span v-else>공지사항 등록</span>
        </button>
      </form>
    </div>

    <div v-if="activeTab === 'notification'" class="notification-form card">
      <h4>알림 발송</h4>
      <p class="description">전체 또는 특정 사용자에게 푸시 알림을 보냅니다.</p>
      
      <div class="form-group">
        <label for="notification-title">알림 제목</label>
        <input id="notification-title" type="text" v-model="notification.title" placeholder="알림의 제목을 입력하세요." />
      </div>
      <div class="form-group">
        <label for="notification-body">알림 내용</label>
        <textarea id="notification-body" v-model="notification.body" rows="4" placeholder="사용자에게 보낼 메시지를 입력하세요."></textarea>
      </div>
       <div class="form-group">
        <label for="notification-link">클릭 시 이동할 링크 (선택 사항)</label>
        <input id="notification-link" type="text" v-model="notification.link" placeholder="예: /community/notices" />
      </div>

      <div class="user-selection-section">
        <h5><i class="fas fa-users"></i> 발송 대상 선택</h5>
        <div v-if="loadingUsers" class="loading-spinner small"></div>
        <div v-else-if="users.length > 0" class="user-list">
          <div class="user-list-header">
            <input type="checkbox" @change="toggleSelectAllUsers" :checked="areAllUsersSelected" />
            <span>전체 선택 (총 {{ users.length }}명)</span>
          </div>
          <div class="user-list-items">
            <div v-for="user in users" :key="user.id" class="user-item">
              <input type="checkbox" :value="user.id" v-model="selectedUserIds" />
              <label>{{ user.name }} ({{ user.email }})</label>
            </div>
          </div>
        </div>
        <div v-else class="no-data">알림 수신 동의 사용자가 없습니다.</div>
      </div>

      <div class="button-group">
        <button class="btn btn-primary" @click="sendNotification('selected')" :disabled="isSendingNotification || selectedUserIds.length === 0">
            <span v-if="isSendingNotification && targetType === 'selected'">전송 중...</span>
            <span v-else>선택된 사용자에게 발송 ({{ selectedUserIds.length }}명)</span>
        </button>
        <button class="btn btn-danger" @click="sendNotification('all')" :disabled="isSendingNotification">
          <span v-if="isSendingNotification && targetType === 'all'">전송 중...</span>
          <span v-else>전체 사용자에게 발송</span>
        </button>
      </div>

       <div v-if="notification.message" :class="notification.isError ? 'message error' : 'message success'">
        <p>{{ notification.message }}</p>
      </div>
    </div>


    <div class="post-list card">
      <h4>게시글 목록</h4>
      <div class="filter-controls">
        <label for="category-filter">게시판 필터:</label>
        <select id="category-filter" v-model="selectedCategory">
          <option value="all">전체 보기</option>
          <option value="notices">공지사항</option>
          <option value="payment_requests">입금승인요청</option>
          <option value="bug_reports">버그 알리기</option>
          <option value="freeboard">자유게시판</option>
        </select>
      </div>

      <div v-if="loadingPosts" class="loading-spinner"></div>
      <table v-else-if="filteredPosts.length > 0" class="post-table">
        <thead>
          <tr>
            <th>유형</th>
            <th>제목</th>
            <th>작성자</th>
            <th>작성일</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in filteredPosts" :key="post.id">
            <td>
              <span :class="`type-badge type-${post.category || 'default'}`">{{ getPostTypeText(post.category) }}</span>
            </td>
            <td>{{ post.title }}</td>
            <td>{{ post.authorName || "시스템" }}</td>
            <td>{{ formatDate(post.createdAt) }}</td>
            <td>
              <button @click="deletePost(post.id)" class="btn btn-sm btn-outline-danger">
                삭제
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">해당 유형의 게시글이 없습니다.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from "vue";
import { db, auth } from "@/firebaseConfig";
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
  where,
} from "firebase/firestore";

const activeTab = ref('notice');
const posts = ref([]);
const loadingPosts = ref(true);
const isSubmittingNotice = ref(false);
const isSendingNotification = ref(false);
const selectedCategory = ref('all');

const users = ref([]);
const loadingUsers = ref(false);
const selectedUserIds = ref([]);
const targetType = ref('');

const newNotice = reactive({ title: "", content: "" });
const notification = reactive({ title: '', body: '', link: '', message: '', isError: false });

const filteredPosts = computed(() => {
  if (selectedCategory.value === 'all') {
    return posts.value;
  }
  return posts.value.filter(post => post.category === selectedCategory.value);
});

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

const getPostTypeText = (category) => {
  const types = {
    notices: '공지',
    payment_requests: '입금승인',
    bug_reports: '버그',
    freeboard: '자유',
  };
  return types[category] || '기타';
};

const fetchPosts = async () => {
  loadingPosts.value = true;
  try {
    const postsRef = collection(db, "posts");
    const q = query(postsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    posts.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("게시글 로딩 오류:", error);
    alert("게시글을 불러오는 데 실패했습니다.");
  } finally {
    loadingPosts.value = false;
  }
};

const createNotice = async () => {
  if (!newNotice.title.trim() || !newNotice.content.trim()) {
    alert("제목과 내용을 모두 입력해주세요.");
    return;
  }
  isSubmittingNotice.value = true;
  try {
    const currentUser = auth.currentUser;
    await addDoc(collection(db, "posts"), {
      title: newNotice.title,
      content: newNotice.content,
      authorId: currentUser.uid,
      authorName: currentUser.displayName || "관리자",
      category: "notices",
      createdAt: serverTimestamp(),
      views: 0
    });
    alert("공지사항이 성공적으로 등록되었습니다.");
    newNotice.title = "";
    newNotice.content = "";
    await fetchPosts();
  } catch (error) {
    console.error("공지사항 등록 오류:", error);
    alert("공지사항 등록에 실패했습니다.");
  } finally {
    isSubmittingNotice.value = false;
  }
};

const deletePost = async (postId) => {
  if (!confirm("정말로 이 게시글을 삭제하시겠습니까?")) return;
  try {
    await deleteDoc(doc(db, "posts", postId));
    alert("게시글이 성공적으로 삭제되었습니다.");
    await fetchPosts();
  } catch (error) {
    console.error("게시글 삭제 오류:", error);
    alert("게시글 삭제에 실패했습니다.");
  }
};

const fetchUsersWithFcmTokens = async () => {
  loadingUsers.value = true;
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("fcmTokens", "!=", []));
    const querySnapshot = await getDocs(q);
    users.value = querySnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      email: doc.data().email,
    }));
  } catch (error) {
    console.error("FCM 토큰 보유 사용자 로딩 오류:", error);
  } finally {
    loadingUsers.value = false;
  }
};

const areAllUsersSelected = computed(() => {
  return users.value.length > 0 && selectedUserIds.value.length === users.value.length;
});

const toggleSelectAllUsers = (event) => {
  if (event.target.checked) {
    selectedUserIds.value = users.value.map(user => user.id);
  } else {
    selectedUserIds.value = [];
  }
};

const sendNotification = async (target) => {
  targetType.value = target;

  if (!notification.title || !notification.body) {
    notification.message = '제목과 내용은 반드시 입력해야 합니다.';
    notification.isError = true;
    return;
  }

  let targetIds = [];
  let confirmMessage = '';

  if (target === 'all') {
    targetIds = 'all';
    confirmMessage = '정말로 모든 사용자에게 알림을 발송하시겠습니까?';
  } else if (target === 'selected') {
    targetIds = selectedUserIds.value;
    if (targetIds.length === 0) {
      notification.message = '발송할 사용자를 선택해주세요.';
      notification.isError = true;
      return;
    }
    confirmMessage = `선택된 ${targetIds.length}명의 사용자에게 알림을 발송하시겠습니까?`;
  }

  if (!confirm(confirmMessage)) return;

  isSendingNotification.value = true;
  notification.message = '';
  notification.isError = false;

  try {
    const functions = getFunctions(undefined, "asia-northeast3");
    const sendNotificationToUsers = httpsCallable(functions, 'sendNotificationToUsers');
    const result = await sendNotificationToUsers({
      target: targetIds,
      title: notification.title,
      body: notification.body,
      link: notification.link || undefined
    });
    
    notification.message = result.data.message;
    notification.isError = !result.data.success;
    
    if (result.data.success) {
      notification.title = '';
      notification.body = '';
      notification.link = '';
      selectedUserIds.value = [];
    }

  } catch (error) {
    console.error("알림 발송 함수 호출 오류:", error);
    notification.message = `알림 발송에 실패했습니다: ${error.message}`;
    notification.isError = true;
  } finally {
    isSendingNotification.value = false;
    targetType.value = '';
  }
};

watch(activeTab, (newTab) => {
  if (newTab === 'notification' && users.value.length === 0) {
    fetchUsersWithFcmTokens();
  }
});

onMounted(fetchPosts);
</script>

<style scoped>
.management-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.card {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3, h4 {
  margin-top: 0;
}
.description {
  margin-top: -10px;
  margin-bottom: 20px;
  color: #6c757d;
}
.tabs {
  display: flex;
  gap: 10px;
  border-bottom: 2px solid #e9ecef;
  margin-bottom: 20px;
}
.tab-button {
  padding: 10px 20px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  font-size: 1.1em;
  font-weight: 600;
  color: #6c757d;
  border-bottom: 3px solid transparent;
  transition: all 0.2s ease-in-out;
}
.tab-button.active {
  color: #007bff;
  border-bottom-color: #007bff;
}
.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}
.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  box-sizing: border-box;
}
.form-group textarea {
  resize: vertical;
}
.message {
  margin-top: 15px;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}
.message.error { background-color: #f8d7da; color: #721c24; }
.message.success { background-color: #d4edda; color: #155724; }
.post-list {
  margin-top: 20px;
}
.filter-controls {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.filter-controls label {
  font-weight: 500;
}
.filter-controls select {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid #ced4da;
}
.post-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}
.post-table th,
.post-table td {
  border-bottom: 1px solid #eee;
  padding: 12px 15px;
  text-align: left;
  vertical-align: middle;
}
.post-table th {
  background-color: #f8f9fa;
}
.type-badge {
  padding: 4px 10px;
  border-radius: 15px;
  font-size: 0.8em;
  font-weight: bold;
  color: #fff;
}
.type-notices { background-color: #17a2b8; }
.type-payment_requests { background-color: #28a745; }
.type-bug_reports { background-color: #ffc107; color: #212529; }
.type-freeboard { background-color: #007bff; }
.type-default { background-color: #6c757d; }
.btn {
  border: none;
  border-radius: 8px;
  padding: 12px 25px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}
.btn-primary { background-color: #007bff; color: white; }
.btn-primary:hover { background-color: #0056b3; }
.btn-danger { background-color: #dc3545; color: white; }
.btn-danger:hover { background-color: #c82333; }
.btn-outline-danger {
    background-color: transparent;
    border: 1px solid #dc3545;
    color: #dc3545;
}
.btn-outline-danger:hover {
    background-color: #dc3545;
    color: white;
}
.btn-sm { padding: 5px 10px; font-size: 0.85em; }
.loading-spinner, .no-data {
  text-align: center;
  padding: 50px;
  color: #777;
}
.loading-spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #007bff;
  animation: spin 1s ease infinite;
  margin: 50px auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
.user-selection-section {
  margin-top: 30px;
  border-top: 1px solid #e9ecef;
  padding-top: 20px;
}
.user-selection-section h5 { font-size: 1.2em; margin-bottom: 15px; }
.user-list { border: 1px solid #ddd; border-radius: 8px; }
.user-list-header {
  padding: 10px 15px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #ddd;
  font-weight: 500;
}
.user-list-header input { margin-right: 10px; }
.user-list-items {
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 15px;
}
.user-item { display: block; margin-bottom: 8px; }
.user-item input { margin-right: 10px; }
.button-group { display: flex; gap: 15px; margin-top: 20px; }
.button-group .btn { flex-grow: 1; }
.loading-spinner.small {
    width: 24px;
    height: 24px;
    border-width: 3px;
    margin: 20px auto;
}
</style>