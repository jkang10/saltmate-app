<template>
  <div class="post-detail-page">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>게시글을 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>
    <div v-else-if="post" class="post-container card glassmorphism">
      <h1 class="post-title">{{ post.title }}</h1>
      <div class="post-meta">
        <span>작성자: {{ post.authorName }}</span>
        <span>|</span>
        <span>작성일: {{ formatDate(post.createdAt) }}</span>
        <span>|</span>
        <span>조회수: {{ post.views || 0 }}</span>
      </div>
      <div class="post-content" v-html="formattedContent"></div>
      <div class="button-container">
        <router-link :to="`/community/${post.category || 'notices'}`" class="back-to-list-button">
          <i class="fas fa-list"></i> 목록으로
        </router-link>
      </div>
    </div>
    <div v-else class="error-state">
      <p>게시글을 찾을 수 없습니다.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { db, functions } from "@/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

const route = useRoute();
const post = ref(null);
const isLoading = ref(true);
const error = ref(null);

// 게시글 내용의 줄바꿈 문자를 <br> 태그로 변환
const formattedContent = computed(() => {
  return post.value?.content?.replace(/\n/g, "<br />") || "";
});

// Firestore 타임스탬프를 날짜 문자열로 변환하는 함수
const formatDate = (timestamp) => {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleDateString("ko-KR");
};

// 게시글 데이터를 불러오고 조회수를 증가시키는 함수
const fetchPost = async () => {
  isLoading.value = true;
  try {
    const postId = route.params.id;
    if (!postId) {
      throw new Error("게시글 ID가 없습니다.");
    }
    const postRef = doc(db, "posts", postId);
    const docSnap = await getDoc(postRef);

    if (docSnap.exists()) {
      post.value = docSnap.data();
      
      // 세션 스토리지를 사용하여 한 브라우저 세션에서 조회수가 한 번만 오르도록 함
      const viewedKey = `viewed_${postId}`;
      if (!sessionStorage.getItem(viewedKey)) {
        // 백엔드에 조회수 증가를 요청
        const incrementView = httpsCallable(functions, "incrementPostView");
        await incrementView({ postId });
        sessionStorage.setItem(viewedKey, "true");
        
        // 화면에 즉시 반영하기 위해 로컬 데이터도 1 증가
        if (post.value.views) {
          post.value.views++;
        } else {
          post.value.views = 1;
        }
      }
    } else {
      error.value = "게시글을 찾을 수 없습니다.";
    }
  } catch (e) {
    console.error("게시글 로딩 오류:", e);
    error.value = "게시글을 불러오는 중 오류가 발생했습니다.";
  } finally {
    isLoading.value = false;
  }
};

// 컴포넌트가 마운트될 때 게시글 데이터를 불러옴
onMounted(fetchPost);
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
.post-title {
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
  margin-bottom: 30px;
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
}
.post-content {
  line-height: 1.8;
  font-size: 1.1em;
  color: #444;
  word-break: keep-all;
  overflow-wrap: break-word;
}
.button-container {
  margin-top: 40px;
  text-align: center;
}
.back-to-list-button {
  background-color: #6c757d;
  color: white;
  padding: 12px 25px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}
.back-to-list-button:hover {
  background-color: #5a6268;
}
.loading-state,
.error-state {
  text-align: center;
  padding: 50px;
  color: #777;
}
.spinner {
  display: inline-block;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top: 4px solid #007bff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>