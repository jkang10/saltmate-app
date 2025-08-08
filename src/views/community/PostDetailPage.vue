<template>
  <div class="post-detail-page">
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>
    <main v-else-if="post" class="post-container card">
      <header class="post-header">
        <h1>{{ post.title }}</h1>
        <div class="post-meta">
          <span>작성자: {{ post.authorName }}</span>
          <span>작성일: {{ formatDate(post.createdAt) }}</span>
          <span>조회수: {{ post.views }}</span>
        </div>
      </header>
      <div class="post-content" v-html="formattedContent"></div>
      <router-link :to="`/community/${post.category}`" class="back-button">
        <i class="fas fa-list"></i> 목록으로 돌아가기
      </router-link>
    </main>
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";

export default {
  name: "PostDetailPage",
  props: ["postId"],
  data() {
    return {
      post: null,
      isLoading: true,
      error: null,
    };
  },
  computed: {
    formattedContent() {
      // v-html에 사용될 때를 대비해, post.content가 존재할 경우에만 replace를 실행합니다.
      return this.post?.content?.replace(/\n/g, "<br />") || "";
    },
  },
  async created() {
    this.isLoading = true;
    this.error = null;

    try {
      const postRef = doc(db, "posts", this.postId);

      // ▼▼▼ [수정됨] 조회수 증가 로직을 별도의 try-catch로 감쌉니다 ▼▼▼
      try {
        // 이 작업은 권한이 있는 사용자(관리자)만 성공합니다.
        // 일반 사용자는 실패하지만, 오류를 던지지 않고 넘어가게 됩니다.
        await updateDoc(postRef, { views: increment(1) });
      } catch (updateError) {
        // 일반 사용자의 권한 없음 오류는 정상적인 동작이므로 콘솔에만 기록합니다.
        console.log(
          "조회수 업데이트 권한이 없습니다 (일반 사용자).",
          updateError.message,
        );
      }
      // ▲▲▲ 수정 완료 ▲▲▲

      // 게시글 데이터 가져오기는 항상 실행됩니다.
      const docSnap = await getDoc(postRef);
      if (docSnap.exists()) {
        this.post = { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("게시글을 찾을 수 없습니다.");
      }
    } catch (fetchError) {
      console.error("게시글 조회 오류:", fetchError);
      this.error = "게시글을 불러오는 데 실패했습니다.";
    } finally {
      this.isLoading = false;
    }
  },
  methods: {
    formatDate(timestamp) {
      if (!timestamp?.toDate) return "날짜 정보 없음";
      return timestamp.toDate().toLocaleString("ko-KR");
    },
  },
};
</script>

<style scoped>
.post-detail-page {
  max-width: 800px;
  margin: 70px auto 20px;
  padding: 20px;
}
.post-container {
  padding: 40px;
}
.post-header {
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
  margin-bottom: 30px;
}
.post-header h1 {
  font-size: 2.2em;
  margin: 0 0 15px;
}
.post-meta {
  display: flex;
  gap: 15px;
  color: #666;
  font-size: 0.9em;
}
.post-content {
  line-height: 1.8;
  font-size: 1.1em;
}
.post-detail-page {
  max-width: 800px;
  margin: 70px auto 20px;
  padding: 20px;
}
.card {
  background: #fff;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.post-header {
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
  margin-bottom: 30px;
}
.post-header h1 {
  font-size: 2.2em;
  margin: 0 0 15px;
}
.post-meta {
  display: flex;
  gap: 15px;
  color: #666;
  font-size: 0.9em;
}
.post-content {
  line-height: 1.8;
  font-size: 1.1em;
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
</style>
