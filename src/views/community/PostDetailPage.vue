<template>
  <div class="post-detail-page">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>게시글을 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>
    <main v-else-if="post" class="post-container card">
      <header class="post-header">
        <h1>{{ post.title }}</h1>
        <div class="post-meta">
          <span>작성자: {{ post.authorName }}</span>
          <span>|</span>
          <span>작성일: {{ formatDate(post.createdAt) }}</span>
          <span>|</span>
          <span>조회수: {{ post.views || 0 }}</span>
        </div>
      </header>
      <div class="post-content" v-html="formattedContent"></div>
      <router-link :to="`/community/${post.category || 'notices'}`" class="back-button">
        <i class="fas fa-list"></i> 목록으로 돌아가기
      </router-link>
    </main>
    <div v-else class="error-state">
      <p>게시글을 찾을 수 없습니다.</p>
    </div>
  </div>
</template>

<script>
import { db, functions } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useRoute } from "vue-router"; // [신규] useRoute import
import { ref, onMounted, computed } from "vue"; // [신규] Vue 3 Composition API 함수 import

export default {
  name: "PostDetailPage",
  // [삭제] props 옵션을 더 이상 사용하지 않으므로 삭제합니다.
  // props: ["postId"],
  setup() {
    const route = useRoute(); // [신규] useRoute를 사용하여 라우트 정보에 접근
    const post = ref(null);
    const isLoading = ref(true);
    const error = ref(null);

    const formattedContent = computed(() => {
      return post.value?.content?.replace(/\n/g, "<br />") || "";
    });

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return "날짜 정보 없음";
      return timestamp.toDate().toLocaleDateString("ko-KR");
    };

    const fetchPost = async () => {
      isLoading.value = true;
      error.value = null;
      try {
        // [수정] this.postId 대신 route.params.postId를 사용하여 URL에서 직접 ID를 가져옵니다.
        const postId = route.params.postId;
        if (!postId) {
          throw new Error("게시글 ID를 찾을 수 없습니다.");
        }
        
        const postRef = doc(db, "posts", postId);

        const viewedKey = `viewed_${postId}`;
        if (!sessionStorage.getItem(viewedKey)) {
          try {
            const incrementView = httpsCallable(functions, "incrementPostView");
            await incrementView({ postId });
            sessionStorage.setItem(viewedKey, "true");
          } catch (viewError) {
            console.error("조회수 업데이트 실패:", viewError);
          }
        }

        const docSnap = await getDoc(postRef);
        if (docSnap.exists()) {
          post.value = { id: docSnap.id, ...docSnap.data() };
          // 조회수가 즉시 반영된 것처럼 보이게 로컬 데이터도 조정
          if (sessionStorage.getItem(viewedKey) && !post.value.views) {
            post.value.views = 1;
          } else if (sessionStorage.getItem(viewedKey) && post.value.views > 0 && !this.initialViewCount) {
            this.initialViewCount = post.value.views;
            post.value.views++;
          }
        } else {
          throw new Error("게시글을 찾을 수 없습니다.");
        }
      } catch (fetchError) {
        console.error("게시글 조회 오류:", fetchError);
        error.value = "게시글을 불러오는 중 오류가 발생했습니다.";
      } finally {
        isLoading.value = false;
      }
    };

    onMounted(fetchPost);

    return {
      post,
      isLoading,
      error,
      formattedContent,
      formatDate,
    };
  },
};
</script>

<style scoped>
.post-detail-page {
  max-width: 800px;
  margin: 90px auto 40px;
  padding: 20px;
}
.card {
  background: rgba(255, 255, 255, 0.9);
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
.post-header {
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
  margin-bottom: 30px;
}
.post-header h1 {
  font-size: 2.2em;
  margin: 0 0 15px;
  color: #333;
}
.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  color: #666;
  font-size: 0.9em;
}
.post-content {
  line-height: 1.8;
  font-size: 1.1em;
  color: #444;
  word-break: keep-all;
  overflow-wrap: break-word;
}
.back-button {
  background-color: #6c757d;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9em;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 40px;
}
.back-button:hover {
  background-color: #5a6268;
}
.loading-state,
.error-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
.spinner {
  display: inline-block;
  border: 4px solid rgba(0,0,0,0.1);
  border-top-color: #007bff;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  animation: spin 1s ease infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>