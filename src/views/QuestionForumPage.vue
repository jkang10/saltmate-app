<template>
  <div class="forum-page">
    <header class="page-header">
      <h1><i class="fas fa-comments"></i>질의 응답</h1>
      <p class="description">편하게 문의를 소통하는 공간입니다.</p>
    </header>

    <main class="forum-content card glassmorphism">
      <div class="forum-actions">
        <input
          type="text"
          placeholder="제목 + 내용 검색"
          class="search-input"
        />
        <router-link to="/community/write" class="write-button">
          <i class="fas fa-pen"></i> 글쓰기
        </router-link>
      </div>

      <ul class="post-list">
        <li v-for="post in posts" :key="post.id" class="post-item">
          <router-link :to="`/community/post/${post.id}`" class="post-link">
            <span class="post-title">{{ post.title }}</span>
            <span class="post-meta">
              <span class="post-author">{{ post.author }}</span> |
              <span class="post-date">{{ post.date }}</span> |
              <span class="post-views">조회 {{ post.views }}</span>
            </span>
          </router-link>
          <div class="post-actions">
            <span class="likes"
              ><i class="fas fa-heart"></i> {{ post.likes }}</span
            >
            <span class="comments"
              ><i class="fas fa-comment"></i> {{ post.comments }}</span
            >
          </div>
        </li>
        <li v-if="posts.length === 0" class="no-posts">
          아직 게시글이 없습니다. 첫 글을 작성해보세요!
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
import { ref } from "vue";

export default {
  name: "FreeForumPage",
  setup() {
    // 임시 게시글 데이터 (나중에 Firebase/API 연동으로 대체)
    const posts = ref([
      {
        id: 101,
        title: "첫인사 드립니다!",
        author: "뉴솔트",
        date: "2024-07-28",
        views: 50,
        likes: 5,
        comments: 2,
      },
      {
        id: 102,
        title: "최근 소금 가격 동향 분석",
        author: "소금분석가",
        date: "2024-07-27",
        views: 120,
        likes: 10,
        comments: 8,
      },
      {
        id: 103,
        title: "솔트메이트 앱 개선 건의합니다",
        author: "아이디어뱅크",
        date: "2024-07-26",
        views: 75,
        likes: 7,
        comments: 4,
      },
    ]);

    return {
      posts,
    };
  },
};
</script>

<style scoped>
.forum-page {
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

.forum-content {
  padding: 30px;
}

.forum-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
  gap: 15px;
}

.search-input {
  flex-grow: 1;
  padding: 12px 18px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  outline: none;
  transition: border-color 0.3s ease;
}

.search-input:focus {
  border-color: #007bff;
}

.write-button {
  background-color: #28a745;
  color: white;
  border: none;
  padding: 12px 20px;
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

.post-title {
  font-size: 1.2em;
  font-weight: bold;
  margin-bottom: 5px;
  color: #34495e;
}

.post-meta {
  font-size: 0.9em;
  color: #777;
}

.post-author,
.post-date,
.post-views {
  margin-right: 12px;
}

.post-actions {
  display: flex;
  gap: 15px;
  margin-left: 20px;
}

.post-actions span {
  font-size: 0.9em;
  color: #555;
}

.post-actions i {
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
  .forum-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .post-item {
    flex-direction: column;
    align-items: flex-start;
  }
  .post-actions {
    margin-left: 0;
    margin-top: 10px;
  }
}
</style>
