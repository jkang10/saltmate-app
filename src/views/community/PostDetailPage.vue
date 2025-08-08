<template>
  <div class="post-detail-page">
    <div v-if="isLoading" class="loading-state">...</div>
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
    };
  },
  computed: {
    formattedContent() {
      return this.post?.content.replace(/\n/g, "<br />");
    },
  },
  async created() {
    const postRef = doc(db, "posts", this.postId);

    // 조회수 증가
    await updateDoc(postRef, { views: increment(1) });

    // 게시글 데이터 가져오기
    const docSnap = await getDoc(postRef);
    if (docSnap.exists()) {
      this.post = { id: docSnap.id, ...docSnap.data() };
    }
    this.isLoading = false;
  },
  methods: {
    formatDate(timestamp) {
      return timestamp?.toDate().toLocaleString("ko-KR");
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
</style>
