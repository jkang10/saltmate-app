<template>
  <div class="post-detail-page">
    <header class="page-header">
      <h1><i class="fas fa-file-alt"></i> 게시글 상세</h1>
      <p class="description">선택하신 게시글의 내용입니다.</p>
    </header>

    <main class="post-content card glassmorphism">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>게시글을 불러오는 중입니다...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p class="error-message">
          😔 게시글을 불러오는 데 실패했습니다: {{ error }}
        </p>
        <button @click="fetchPost" class="retry-button">다시 시도</button>
      </div>

      <div v-else-if="!post" class="not-found-state">
        <p>요청하신 게시글을 찾을 수 없습니다.</p>
        <router-link to="/community/free" class="back-button"
          >목록으로 돌아가기</router-link
        >
      </div>

      <div v-else class="post-detail">
        <h2 class="post-title">{{ post.title }}</h2>
        <div class="post-meta">
          <span class="author"
            ><i class="fas fa-user"></i> {{ post.author }}</span
          >
          <span class="date"><i class="fas fa-clock"></i> {{ post.date }}</span>
          <span class="views"><i class="fas fa-eye"></i> {{ post.views }}</span>
          <span class="likes"
            ><i class="fas fa-heart"></i> {{ post.likes }}</span
          >
        </div>

        <div class="post-body">
          <p>{{ post.content }}</p>
        </div>

        <div class="post-actions-bottom">
          <button
            class="action-button secondary-outline"
            @click="editPost"
            v-if="isAuthor"
          >
            <i class="fas fa-edit"></i> 수정
          </button>
          <button
            class="action-button danger-outline"
            @click="deletePost"
            v-if="isAuthor"
          >
            <i class="fas fa-trash-alt"></i> 삭제
          </button>
          <router-link to="/community/free" class="action-button back-to-list">
            <i class="fas fa-list"></i> 목록으로
          </router-link>
        </div>

        <section class="comments-section">
          <h3>댓글 ({{ post.comments ? post.comments.length : 0 }})</h3>
          <div class="comment-input-area">
            <textarea
              placeholder="댓글을 작성하세요..."
              v-model="newCommentContent"
            ></textarea>
            <button class="comment-submit-button" @click="addComment">
              댓글 작성
            </button>
          </div>
          <ul
            class="comment-list"
            v-if="post.comments && post.comments.length > 0"
          >
            <li
              v-for="comment in post.comments"
              :key="comment.id"
              class="comment-item"
            >
              <div class="comment-author">{{ comment.author }}</div>
              <div class="comment-content">{{ comment.content }}</div>
              <div class="comment-date">{{ comment.date }}</div>
            </li>
          </ul>
          <p v-else class="no-comments">
            아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
          </p>
        </section>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
// Firebase 관련 임포트 (필요 시 추가)
// import { auth, db } from '@/firebaseConfig';
// import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

export default {
  name: "PostDetailPage",
  props: ["id"], // router/index.js에서 props: true 설정 시 id를 props로 받음
  setup(props) {
    const route = useRoute();
    const router = useRouter();
    const postId = ref(props.id); // URL에서 넘어온 게시글 ID
    const post = ref(null);
    const loading = ref(true);
    const error = ref(null);
    const newCommentContent = ref("");
    const currentUserUid = ref("user123"); // 실제 사용자 UID (Firebase Auth에서 가져옴)

    // 임시 게시글 데이터 (나중에 Firebase/API 연동으로 대체)
    const mockPosts = {
      101: {
        id: "101",
        title: "첫인사 드립니다!",
        author: "뉴솔트",
        content:
          "솔트메이트에 가입하고 첫 글을 써봅니다. 잘 부탁드립니다! 궁금한 점이 많으니 많이 도와주세요.",
        date: "2024-07-28",
        views: 55,
        likes: 6,
        authorUid: "user123", // 작성자 UID (예시)
        comments: [
          {
            id: "c1",
            author: "관리자",
            content:
              "환영합니다! 궁금한 점은 언제든지 질문 게시판을 이용해주세요.",
            date: "2024-07-28",
          },
          {
            id: "c2",
            author: "선배솔트",
            content: "반갑습니다! :)",
            date: "2024-07-28",
          },
        ],
      },
      102: {
        id: "102",
        title: "최근 소금 가격 동향 분석",
        author: "소금분석가",
        content:
          "최근 국제 소금 가격이 변동성이 커지고 있습니다. 자세한 내용은 보고서를 참고해주세요. (보고서 링크 삽입 예정)",
        date: "2024-07-27",
        views: 125,
        likes: 11,
        authorUid: "user456",
        comments: [],
      },
    };

    const fetchPost = async () => {
      loading.value = true;
      error.value = null;
      try {
        // 실제로는 Firebase Firestore에서 게시글 ID에 해당하는 문서를 가져옵니다.
        // const docRef = doc(db, "posts", postId.value);
        // const docSnap = await getDoc(docRef);
        // if (docSnap.exists()) {
        //   post.value = { id: docSnap.id, ...docSnap.data() };
        // } else {
        //   post.value = null;
        // }

        // 임시 데이터 사용
        post.value = mockPosts[postId.value] || null;

        if (post.value) {
          // 조회수 증가 (실제 DB에서는 트랜잭션으로 안전하게 처리)
          // await updateDoc(doc(db, "posts", postId.value), {
          //   views: increment(1)
          // });
          // post.value.views++; // UI 업데이트
        }
      } catch (e) {
        console.error("Error fetching post:", e);
        error.value = e.message;
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      // 컴포넌트 마운트 시 게시글 ID가 props로 전달되었는지 확인
      if (!postId.value) {
        postId.value = route.params.id; // props로 안오면 라우트 파람에서 다시 시도
      }
      fetchPost();
    });

    const isAuthor = computed(() => {
      // 실제 UID와 게시글 작성자 UID 비교
      return post.value && post.value.authorUid === currentUserUid.value;
    });

    const editPost = () => {
      // 게시글 수정 페이지로 이동
      router.push(`/community/write?id=${postId.value}`);
    };

    const deletePost = async () => {
      if (confirm("정말로 이 게시글을 삭제하시겠습니까?")) {
        try {
          // 실제 Firebase Firestore에서 게시글 삭제 로직
          // await deleteDoc(doc(db, "posts", postId.value));
          alert("게시글이 삭제되었습니다.");
          router.push("/community/free"); // 삭제 후 목록으로 이동
        } catch (e) {
          console.error("게시글 삭제 오류:", e);
          alert("게시글 삭제에 실패했습니다.");
        }
      }
    };

    const addComment = async () => {
      if (!newCommentContent.value.trim()) {
        alert("댓글 내용을 입력해주세요.");
        return;
      }
      // 실제 Firebase Firestore에 댓글 추가 로직
      // const newComment = {
      //   id: Date.now().toString(), // 임시 ID
      //   author: auth.currentUser ? auth.currentUser.displayName || auth.currentUser.email : '익명',
      //   content: newCommentContent.value,
      //   date: new Date().toLocaleDateString(), // 간략한 날짜
      //   createdAt: Timestamp.now(),
      // };
      // await updateDoc(doc(db, "posts", postId.value), {
      //   comments: arrayUnion(newComment)
      // });
      // post.value.comments.push(newComment); // UI 업데이트

      const newComment = {
        id: Date.now().toString(),
        author: "현재 사용자", // 로그인된 사용자 이름으로 변경
        content: newCommentContent.value,
        date: new Date().toLocaleDateString(),
      };
      if (post.value) {
        if (!post.value.comments) {
          post.value.comments = [];
        }
        post.value.comments.push(newComment);
      }
      newCommentContent.value = "";
      alert("댓글이 작성되었습니다.");
    };

    return {
      postId,
      post,
      loading,
      error,
      newCommentContent,
      isAuthor,
      fetchPost,
      editPost,
      deletePost,
      addComment,
    };
  },
};
</script>

<style scoped>
.post-detail-page {
  padding: 20px;
  max-width: 900px;
  margin: 30px auto;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 2.8em;
  color: #333;
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.page-header .description {
  font-size: 1.1em;
  color: #666;
}

.post-content {
  padding: 30px;
  border-radius: 12px;
}

.loading-state,
.error-state,
.not-found-state {
  text-align: center;
  padding: 50px;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-message {
  color: #dc3545;
  font-weight: bold;
}

.retry-button,
.back-button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  text-decoration: none;
  font-size: 1em;
  transition: background-color 0.3s ease;
}

.retry-button:hover,
.back-button:hover {
  background-color: #0056b3;
}

.post-detail {
  /* 게시글 상세 내용 스타일 */
}

.post-title {
  font-size: 2.2em;
  color: #34495e;
  margin-bottom: 15px;
  word-break: break-word;
}

.post-meta {
  font-size: 0.9em;
  color: #777;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
  margin-bottom: 25px;
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
}

.post-meta span i {
  margin-right: 5px;
  color: #999;
}

.post-body {
  line-height: 1.8;
  font-size: 1.1em;
  color: #444;
  min-height: 150px; /* 최소 높이 설정 */
  margin-bottom: 30px;
  white-space: pre-wrap; /* 줄바꿈 유지 */
}

.post-actions-bottom {
  display: flex;
  justify-content: flex-end; /* 버튼을 오른쪽으로 정렬 */
  gap: 10px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  margin-bottom: 40px;
}

.action-button {
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95em;
  font-weight: bold;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.action-button.primary-outline {
  background-color: transparent;
  color: #007bff;
  border: 2px solid #007bff;
}
.action-button.primary-outline:hover {
  background-color: #e7f3ff;
}

.action-button.secondary-outline {
  background-color: transparent;
  color: #6c757d;
  border: 2px solid #6c757d;
}
.action-button.secondary-outline:hover {
  background-color: #f8f9fa;
}

.action-button.danger-outline {
  background-color: transparent;
  color: #dc3545;
  border: 2px solid #dc3545;
}
.action-button.danger-outline:hover {
  background-color: #ffeef0;
}

.action-button.back-to-list {
  background-color: #6c757d;
  color: white;
  border: none;
}
.action-button.back-to-list:hover {
  background-color: #5a6268;
}

/* 댓글 섹션 */
.comments-section {
  background-color: rgba(255, 255, 255, 0.5);
  padding: 25px;
  border-radius: 10px;
  margin-top: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.comments-section h3 {
  font-size: 1.6em;
  color: #34495e;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.comment-input-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 25px;
}

.comment-input-area textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  resize: vertical;
  outline: none;
  transition: border-color 0.3s ease;
}

.comment-input-area textarea:focus {
  border-color: #007bff;
}

.comment-submit-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  align-self: flex-end; /* 오른쪽 아래 정렬 */
  transition: background-color 0.3s ease;
}

.comment-submit-button:hover {
  background-color: #0056b3;
}

.comment-list {
  list-style: none;
  padding: 0;
}

.comment-item {
  background-color: rgba(255, 255, 255, 0.7);
  padding: 15px 20px;
  border-radius: 10px;
  margin-bottom: 10px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.03);
}

.comment-author {
  font-weight: bold;
  color: #333;
  margin-bottom: 5px;
  font-size: 0.95em;
}

.comment-content {
  color: #444;
  line-height: 1.6;
  margin-bottom: 5px;
  white-space: pre-wrap;
}

.comment-date {
  font-size: 0.8em;
  color: #888;
  text-align: right;
}

.no-comments {
  text-align: center;
  color: #888;
  padding: 20px;
  font-style: italic;
}

/* Glassmorphism 스타일 */
.card {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
</style>
