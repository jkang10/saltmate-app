<template>
  <div class="post-detail-page">
    <div v-if="loading" class="loading-spinner"></div>
    <div v-else-if="post" class="post-container card">
      <header class="post-header">
        <h1>{{ post.title }}</h1>
        <div class="post-meta">
          <span>작성자: {{ post.authorName }}</span>
          <span>작성일: {{ formatDate(post.createdAt) }}</span>
          <span>조회수: {{ post.views }}</span>
        </div>
      </header>
      <main class="post-content" v-html="post.content"></main>

      <div class="post-actions" v-if="isAuthorOrAdmin">
         <button @click="deletePost" class="btn btn-danger">글 삭제</button>
      </div>
    </div>
    <div v-else class="no-post">
      게시글을 찾을 수 없습니다.
    </div>

    <section class="comments-section card" v-if="post">
      <h3><i class="fas fa-comments"></i> 댓글</h3>
      <div v-if="comments.length > 0" class="comment-list">
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <p class="comment-author">{{ comment.authorName }}</p>
          <p class="comment-body">{{ comment.content }}</p>
          <p class="comment-date">{{ formatDate(comment.createdAt) }}</p>
        </div>
      </div>
      <div v-else class="no-comments">
        아직 댓글이 없습니다.
      </div>

      <div v-if="isAdmin" class="comment-form">
        <h4>댓글 작성</h4>
        <textarea v-model="newComment" placeholder="관리자만 댓글을 작성할 수 있습니다."></textarea>
        <button @click="addComment" class="btn btn-primary">댓글 등록</button>
      </div>
    </section>

     <div class="navigation-buttons">
        <router-link :to="`/community/${post.category || 'notices'}`" class="btn btn-secondary">목록으로</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, defineProps } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { db, auth } from '@/firebaseConfig';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc } from 'firebase/firestore';

const props = defineProps({
  postId: {
    type: String,
    required: true,
  },
});

const route = useRoute();
const router = useRouter();
const post = ref(null);
const comments = ref([]);
const newComment = ref('');
const loading = ref(true);
const isAdmin = ref(false);

const isAuthorOrAdmin = computed(() => {
  if (!auth.currentUser || !post.value) return false;
  return auth.currentUser.uid === post.value.authorId || isAdmin.value;
});

const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return '';
  return timestamp.toDate().toLocaleString('ko-KR');
};

const fetchPostAndComments = async () => {
  loading.value = true;
  try {
    // 게시글 가져오기
    const postRef = doc(db, 'posts', props.postId);
    const postSnap = await getDoc(postRef);

    if (postSnap.exists()) {
      post.value = { id: postSnap.id, ...postSnap.data() };
      // 조회수 1 증가 (본인 글이 아닐 때만)
      if (auth.currentUser?.uid !== post.value.authorId) {
        await updateDoc(postRef, { views: (post.value.views || 0) + 1 });
      }

      // 댓글 가져오기
      const commentsRef = collection(db, 'posts', props.postId, 'comments');
      const q = query(commentsRef, orderBy('createdAt', 'asc'));
      const commentsSnap = await getDocs(q);
      comments.value = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    } else {
      console.error("게시글을 찾을 수 없습니다.");
    }
  } catch (error) {
    console.error("데이터 로딩 오류:", error);
  } finally {
    loading.value = false;
  }
};

const addComment = async () => {
  if (!newComment.value.trim() || !isAdmin.value) return;

  try {
    const commentsRef = collection(db, 'posts', props.postId, 'comments');
    await addDoc(commentsRef, {
      content: newComment.value,
      authorId: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || '관리자',
      createdAt: serverTimestamp(),
    });
    newComment.value = '';
    await fetchPostAndComments(); // 댓글 목록 새로고침
  } catch (error) {
    console.error("댓글 작성 오류:", error);
    alert("댓글 작성에 실패했습니다.");
  }
};

const deletePost = async () => {
    if (!confirm("정말로 이 게시글을 삭제하시겠습니까?")) return;
    try {
        await deleteDoc(doc(db, "posts", props.postId));
        alert("게시글이 삭제되었습니다.");
        router.push(`/community/${post.value.category || 'notices'}`);
    } catch (error) {
        console.error("게시글 삭제 오류:", error);
        alert("게시글 삭제에 실패했습니다.");
    }
};

onMounted(async () => {
  const user = auth.currentUser;
  if (user) {
    const idTokenResult = await user.getIdTokenResult();
    isAdmin.value = idTokenResult.claims.admin === true;
  }
  await fetchPostAndComments();
});
</script>

<style scoped>
.post-detail-page {
  max-width: 900px;
  margin: 20px auto;
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
.post-header {
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
  padding-bottom: 20px;
}
.post-header h1 {
  font-size: 2.2em;
  margin: 0 0 15px;
}
.post-meta {
  display: flex;
  gap: 20px;
  font-size: 0.9em;
  color: #777;
}
.post-content {
  line-height: 1.8;
  font-size: 1.1em;
  min-height: 200px;
  white-space: pre-wrap; /* 줄바꿈 및 공백 유지 */
}
.post-actions {
    text-align: right;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #eee;
}

.comments-section h3 {
  font-size: 1.6em;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.comment-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.comment-item {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
}
.comment-author {
  font-weight: bold;
  margin: 0 0 5px;
}
.comment-body {
  margin: 0 0 10px;
}
.comment-date {
  font-size: 0.8em;
  color: #888;
  text-align: right;
  margin: 0;
}
.no-comments, .no-post {
  text-align: center;
  color: #888;
  padding: 30px;
}
.comment-form {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}
.comment-form textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  resize: vertical;
  margin-bottom: 10px;
}
.navigation-buttons {
    text-align: center;
}
.btn {
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}
.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-danger {
    background-color: #dc3545;
    color: white;
}
.btn-secondary {
    background-color: #6c757d;
    color: white;
    text-decoration: none;
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
  to { transform: rotate(360deg); }
}
</style>
