<template>
  <div class="all-posts-page">
    <header class="page-header">
      <h1><i class="fas fa-list-ul"></i> 모든 게시글</h1>
      <p class="description">커뮤니티의 모든 게시글을 한눈에 확인하세요.</p>
    </header>

    <main class="posts-content card glassmorphism">
      <div class="posts-filter-actions">
        <select v-model="selectedCategory" class="filter-select">
          <option value="">전체 게시판</option>
          <option value="free">자유 게시판</option>
          <option value="questions">질문 게시판</option>
          <option value="reviews">투자 후기</option>
        </select>
        <input type="text" placeholder="게시글 검색..." class="search-input" />
        <router-link to="/community/write" class="write-button">
          <i class="fas fa-pen"></i> 글쓰기
        </router-link>
      </div>

      <ul class="post-list">
        <li v-for="post in filteredPosts" :key="post.id" class="post-item">
          <router-link :to="`/community/post/${post.id}`" class="post-link">
            <span class="post-category-tag" :class="post.category">{{
              getCategoryText(post.category)
            }}</span>
            <span class="post-title">{{ post.title }}</span>
            <span class="post-meta">
              <span class="post-author">{{ post.author }}</span> |
              <span class="post-date">{{ post.date }}</span> |
              <span class="post-views">조회 {{ post.views }}</span>
            </span>
          </router-link>
          <div class="post-actions-meta">
            <span class="likes"
              ><i class="fas fa-heart"></i> {{ post.likes }}</span
            >
            <span class="comments"
              ><i class="fas fa-comment"></i> {{ post.commentsCount }}</span
            >
          </div>
        </li>
        <li v-if="filteredPosts.length === 0" class="no-posts">
          해당 조건에 맞는 게시글이 없습니다.
        </li>
      </ul>

      <div class="pagination">
        <button class="page-button">&lt; 이전</button>
        <button class="page-button active">1</button>
        <button class="page-button">2</button>
        <button class="page-button">3</button>
        <button class="page-button">다음 &gt;</button>
      </div>
    </main>
  </div>
</template>

<script>
import { ref, computed } from "vue";

export default {
  name: "AllPostsPage",
  setup() {
    const selectedCategory = ref("");
    const searchQuery = ref("");

    // 임시 게시글 데이터 (나중에 Firebase/API 연동으로 대체)
    const allPosts = ref([
      {
        id: 101,
        category: "free",
        title: "첫인사 드립니다!",
        author: "뉴솔트",
        date: "2024-07-28",
        views: 50,
        likes: 5,
        commentsCount: 2,
      },
      {
        id: 102,
        category: "questions",
        title: "소금 투자 세금 관련 질문입니다.",
        author: "세금궁금",
        date: "2024-07-28",
        views: 30,
        likes: 2,
        commentsCount: 1,
      },
      {
        id: 103,
        category: "free",
        title: "최근 소금 가격 동향 분석",
        author: "소금분석가",
        date: "2024-07-27",
        views: 120,
        likes: 10,
        commentsCount: 8,
      },
      {
        id: 104,
        category: "reviews",
        title: "첫 투자 후기! 만족스럽습니다!",
        author: "초보투자자",
        date: "2024-07-27",
        views: 90,
        likes: 15,
        commentsCount: 5,
      },
      {
        id: 105,
        category: "questions",
        title: "NFT 연동 방법이 궁금해요",
        author: "NFT초보",
        date: "2024-07-25",
        views: 52,
        likes: 7,
        commentsCount: 4,
      },
    ]);

    const filteredPosts = computed(() => {
      let filtered = allPosts.value;

      if (selectedCategory.value) {
        filtered = filtered.filter(
          (post) => post.category === selectedCategory.value,
        );
      }

      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter(
          (post) =>
            post.title.toLowerCase().includes(query) ||
            post.content.toLowerCase().includes(query) || // content는 실제 데이터에 있어야 함
            post.author.toLowerCase().includes(query),
        );
      }

      return filtered;
    });

    const getCategoryText = (category) => {
      switch (category) {
        case "free":
          return "자유";
        case "questions":
          return "질문";
        case "reviews":
          return "후기";
        default:
          return "기타";
      }
    };

    return {
      selectedCategory,
      searchQuery,
      filteredPosts,
      getCategoryText,
    };
  },
};
</script>

<style scoped>
.all-posts-page {
  padding: 20px;
  max-width: 1000px;
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

.posts-content {
  padding: 30px;
}

.posts-filter-actions {
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
  flex-wrap: wrap; /* 작은 화면에서 줄바꿈 */
  justify-content: space-between;
  align-items: center;
}

.filter-select,
.search-input {
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  outline: none;
  transition: border-color 0.3s ease;
  flex-grow: 1; /* 너비 자동 조절 */
}

.filter-select {
  flex-basis: 180px; /* 최소 너비 */
}

.search-input {
  flex-basis: 250px; /* 최소 너비 */
}

.filter-select:focus,
.search-input:focus {
  border-color: #007bff;
}

.write-button {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  font-weight: bold;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.3s ease;
}

.write-button:hover {
  background-color: #218838;
}

.post-list {
  list-style: none;
  padding: 0;
  margin-bottom: 30px;
}

.post-item {
  background-color: rgba(255, 255, 255, 0.4);
  padding: 18px 25px;
  border-radius: 10px;
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.post-item:hover {
  background-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}

.post-link {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: #333;
}

.post-category-tag {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 5px;
  font-size: 0.8em;
  font-weight: bold;
  margin-bottom: 5px;
  color: white;
}
.post-category-tag.free {
  background-color: #007bff;
}
.post-category-tag.questions {
  background-color: #ffc107;
  color: #333;
}
.post-category-tag.reviews {
  background-color: #28a745;
}

.post-title {
  font-size: 1.15em;
  font-weight: bold;
  margin-bottom: 5px;
  color: #34495e;
}

.post-meta {
  font-size: 0.85em;
  color: #777;
}

.post-author,
.post-date,
.post-views {
  margin-right: 12px;
}

.post-actions-meta {
  display: flex;
  gap: 15px;
  margin-left: 20px;
}

.post-actions-meta span {
  font-size: 0.9em;
  color: #555;
}

.post-actions-meta i {
  margin-right: 5px;
  color: #888;
}

.no-posts {
  text-align: center;
  color: #888;
  padding: 50px;
  font-style: italic;
  font-size: 1.1em;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 20px;
}

.page-button {
  background-color: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  padding: 10px 15px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1em;
  transition:
    background-color 0.3s ease,
    color 0.3s ease;
}

.page-button:hover:not(.active) {
  background-color: #e0e0e0;
}

.page-button.active {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
  font-weight: bold;
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

/* 반응형 디자인 */
@media (max-width: 768px) {
  .posts-filter-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .post-item {
    flex-direction: column;
    align-items: flex-start;
  }
  .post-actions-meta {
    margin-left: 0;
    margin-top: 10px;
  }
}
</style>
