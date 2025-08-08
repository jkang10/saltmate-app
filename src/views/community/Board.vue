<template>
  <div class="board-page">
    <header class="page-header">
      <h1><i :class="boardIcon"></i> {{ boardTitle }}</h1>
    </header>

    <main class="board-content card">
      <div class="board-actions">
        <input type="text" placeholder="검색..." class="search-input" />
        <router-link
          :to="{ path: '/community/write', query: { category: category } }"
          class="write-button"
        >
          <i class="fas fa-pen"></i> 글쓰기
        </router-link>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
      </div>
      <table v-else-if="posts.length > 0" class="post-table">
        <thead>
          <tr>
            <th>제목</th>
            <th>작성자</th>
            <th>작성일</th>
            <th>조회수</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="post in posts" :key="post.id" @click="goToPost(post.id)">
            <td class="post-title">{{ post.title }}</td>
            <td>{{ post.authorName }}</td>
            <td>{{ formatDate(post.createdAt) }}</td>
            <td>{{ post.views || 0 }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state">
        <p>아직 등록된 게시글이 없습니다.</p>
      </div>
    </main>
  </div>
</template>

<script>
import { db } from "@/firebaseConfig";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useRouter } from "vue-router";

export default {
  name: "BoardPage",
  props: ["category"],
  data() {
    return {
      posts: [],
      isLoading: true,
      boardInfo: {
        notices: { title: "공지사항", icon: "fas fa-bullhorn" },
        "nft-bids": { title: "NFT 입찰 정보", icon: "fas fa-gavel" },
        "equity-info": { title: "지분 공지 정보", icon: "fas fa-chart-pie" },
        "salt-tech": { title: "소금 기술 이야기", icon: "fas fa-flask" },
        "solein-tech": { title: "스마트 솔레인 테크", icon: "fas fa-robot" },
        "deep-sea-water": { title: "해양 심층수", icon: "fas fa-water" },
      },
    };
  },
  computed: {
    boardTitle() {
      return this.boardInfo[this.category]?.title || "게시판";
    },
    boardIcon() {
      return this.boardInfo[this.category]?.icon || "fas fa-clipboard-list";
    },
  },
  created() {
    this.fetchPosts();
  },
  methods: {
    async fetchPosts() {
      this.isLoading = true;
      try {
        const q = query(
          collection(db, "posts"),
          where("category", "==", this.category),
          orderBy("createdAt", "desc"),
        );
        const querySnapshot = await getDocs(q);
        this.posts = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error("게시글 조회 오류:", error);
        alert("게시글을 불러오는 데 실패했습니다.");
      } finally {
        this.isLoading = false;
      }
    },
    formatDate(timestamp) {
      if (!timestamp?.toDate) return "";
      return timestamp.toDate().toLocaleDateString("ko-KR");
    },
    goToPost(postId) {
      this.$router.push(`/community/post/${postId}`);
    },
  },
};
</script>

<style scoped>
/* 게시판 페이지 스타일 */
.board-page {
  max-width: 1000px;
  margin: 70px auto 20px;
  padding: 20px;
}
.page-header {
  text-align: center;
  margin-bottom: 30px;
}
.page-header h1 {
  font-size: 2.5em;
}
.card {
  background: #fff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}
.board-actions {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}
.search-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}
.write-button {
  background-color: #007bff;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: bold;
}
.post-table {
  width: 100%;
  border-collapse: collapse;
}
.post-table th,
.post-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  text-align: center;
}
.post-table thead th {
  background-color: #f8f9fa;
}
.post-table tbody tr {
  cursor: pointer;
}
.post-table tbody tr:hover {
  background-color: #f1f1f1;
}
.post-title {
  text-align: left;
}
.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
}
</style>
