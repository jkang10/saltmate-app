<template>
  <div class="management-container">
    <h3><i class="fas fa-bullhorn"></i> 공지사항 및 커뮤니티 관리</h3>
    <p>새로운 공지사항을 작성하거나 게시글을 관리합니다.</p>

    <div class="notice-form card">
      <h4>새 공지사항 작성</h4>
      <form @submit.prevent="createNotice">
        <div class="form-group">
          <label for="title">제목</label>
          <input
            type="text"
            id="title"
            v-model="newNotice.title"
            placeholder="공지사항 제목을 입력하세요"
            required
          />
        </div>
        <div class="form-group">
          <label for="content">내용</label>
          <textarea
            id="content"
            v-model="newNotice.content"
            rows="5"
            placeholder="공지사항 내용을 입력하세요"
            required
          ></textarea>
        </div>
        <button type="submit" class="btn btn-primary">공지사항 등록</button>
      </form>
    </div>

    <div class="post-list card">
      <h4>게시글 목록</h4>
      <div v-if="loading" class="loading-spinner"></div>
      <table v-else-if="posts.length > 0" class="post-table">
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
          <tr v-for="post in posts" :key="post.id">
            <td>
              <span :class="`type-badge type-${post.type || 'default'}`">{{
                post.type === "notice" ? "공지" : "커뮤니티"
              }}</span>
            </td>
            <td>{{ post.title }}</td>
            <td>{{ post.authorName || "시스템" }}</td>
            <td>{{ formatDate(post.createdAt) }}</td>
            <td>
              <button
                @click="deletePost(post.id)"
                class="btn btn-sm btn-danger"
              >
                삭제
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="no-data">작성된 게시글이 없습니다.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { db, auth } from "@/firebaseConfig";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";

const posts = ref([]);
const loading = ref(true);
const newNotice = reactive({
  title: "",
  content: "",
});

// --- Helper Functions ---
const formatDate = (timestamp) => {
  if (!timestamp) return "";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

// --- Firestore Functions ---
const fetchPosts = async () => {
  loading.value = true;
  try {
    const postsRef = collection(db, "posts");
    const q = query(postsRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    posts.value = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("게시글을 불러오는 중 오류 발생:", error);
    alert("게시글을 불러오는 데 실패했습니다.");
  } finally {
    loading.value = false;
  }
};

const createNotice = async () => {
  if (!newNotice.title.trim() || !newNotice.content.trim()) {
    alert("제목과 내용을 모두 입력해주세요.");
    return;
  }

  try {
    await addDoc(collection(db, "posts"), {
      title: newNotice.title,
      content: newNotice.content,
      authorId: auth.currentUser.uid,
      authorName: "관리자", // 현재 로그인한 관리자 이름으로 설정 가능
      type: "notice", // 관리자가 작성하는 글은 'notice' 타입으로 지정
      createdAt: serverTimestamp(),
    });

    alert("공지사항이 성공적으로 등록되었습니다.");
    newNotice.title = "";
    newNotice.content = "";
    await fetchPosts(); // 목록 새로고침
  } catch (error) {
    console.error("공지사항 등록 중 오류 발생:", error);
    alert("공지사항 등록에 실패했습니다.");
  }
};

const deletePost = async (postId) => {
  const confirmation = confirm("정말로 이 게시글을 삭제하시겠습니까?");
  if (!confirmation) return;

  try {
    await deleteDoc(doc(db, "posts", postId));
    alert("게시글이 성공적으로 삭제되었습니다.");
    await fetchPosts(); // 목록 새로고침
  } catch (error) {
    console.error("게시글 삭제 중 오류 발생:", error);
    alert("게시글 삭제에 실패했습니다.");
  }
};

onMounted(fetchPosts);
</script>

<style scoped>
.management-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
.card {
  background-color: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
h3,
h4 {
  margin-top: 0;
}

/* 공지사항 작성 폼 */
.notice-form .form-group {
  margin-bottom: 20px;
}
.notice-form label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}
.notice-form input,
.notice-form textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 1em;
  box-sizing: border-box;
}
.notice-form textarea {
  resize: vertical;
}

/* 게시글 목록 테이블 */
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
}
.post-table th {
  background-color: #f8f9fa;
}

/* 타입 배지 */
.type-badge {
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 0.8em;
  font-weight: bold;
  color: #fff;
  text-transform: uppercase;
}
.type-notice {
  background-color: #17a2b8; /* 청록색 */
}
.type-community,
.type-default {
  background-color: #6c757d; /* 회색 */
}

/* 공용 버튼 및 로딩 스타일 */
.btn {
  border: none;
  border-radius: 5px;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-primary:hover {
  background-color: #0056b3;
}
.btn-danger {
  background-color: #dc3545;
  color: white;
}
.btn-sm {
  padding: 5px 10px;
  font-size: 0.85em;
}
.loading-spinner,
.no-data {
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
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
