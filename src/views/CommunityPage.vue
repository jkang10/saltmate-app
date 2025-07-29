<template>
  <div class="community-page">
    <header class="page-header">
      <h1>🗣️ 솔트메이트 커뮤니티</h1>
      <p class="description">
        솔트메이트 사용자들과 자유롭게 소통하고 정보를 공유하는 공간입니다.
      </p>
    </header>

    <main class="community-main">
      <section class="forum-list card glassmorphism">
        <h2><i class="fas fa-list-alt"></i> 게시판</h2>
        <ul>
          <li><router-link to="/community/free">자유 게시판</router-link></li>
          <li>
            <router-link to="/community/questions">질문 게시판</router-link>
          </li>
          <li><router-link to="/community/reviews">투자 후기</router-link></li>
          <li class="coming-soon">건의사항 (준비 중)</li>
        </ul>
      </section>

      <section class="post-list card glassmorphism">
        <h2><i class="fas fa-newspaper"></i> 최신 게시글</h2>
        <div class="search-and-write">
          <input
            type="text"
            placeholder="게시글 검색..."
            class="search-input"
          />
          <router-link to="/community/write" class="write-post-button">
            <i class="fas fa-pen"></i> 글쓰기
          </router-link>
        </div>

        <ul class="posts">
          <li v-for="post in recentPosts" :key="post.id" class="post-item">
            <router-link :to="`/community/post/${post.id}`" class="post-link">
              <span class="post-title">{{ post.title }}</span>
              <span class="post-meta">
                <span class="post-author">{{ post.author }}</span> |
                <span class="post-date">{{ post.date }}</span> |
                <span class="post-views">조회 {{ post.views }}</span>
              </span>
            </router-link>
          </li>
          <li v-if="recentPosts.length === 0" class="no-posts">
            아직 게시글이 없습니다. 첫 글을 작성해보세요!
          </li>
        </ul>
        <router-link to="/community/all-posts" class="view-all-button">
          모든 게시글 보기 <i class="fas fa-arrow-right"></i>
        </router-link>
      </section>
    </main>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  name: "CommunityPage",
  setup() {
    // 임시 데이터 (나중에 Firebase/API 연동으로 대체)
    const recentPosts = ref([
      {
        id: 1,
        title: "솔트메이트 새 소식: 여름 프로모션 안내",
        author: "관리자",
        date: "2024-07-27",
        views: 125,
      },
      {
        id: 2,
        title: "투자 성공 후기 공유합니다!",
        author: "투자왕김솔트",
        date: "2024-07-26",
        views: 88,
      },
      {
        id: 3,
        title: "공장 지분 NFT 관련 질문 드립니다.",
        author: "NFT초보",
        date: "2024-07-25",
        views: 52,
      },
      {
        id: 4,
        title: "다음 투자 상품은 언제 나오나요?",
        author: "기다림의미학",
        date: "2024-07-24",
        views: 70,
      },
    ]);

    return {
      recentPosts,
    };
  },
};
</script>

<style scoped>
.community-page {
  padding: 20px;
  max-width: 1200px;
  margin: 30px auto;
}

.page-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-header h1 {
  font-size: 3em;
  color: #333;
  margin-bottom: 10px;
}

.page-header .description {
  font-size: 1.1em;
  color: #666;
}

.community-main {
  display: grid;
  grid-template-columns: 250px 1fr; /* 게시판 목록 | 게시글 목록 */
  gap: 30px;
}

@media (max-width: 992px) {
  .community-main {
    grid-template-columns: 1fr; /* 태블릿 이하에서는 세로로 배치 */
  }
  .forum-list {
    margin-bottom: 20px;
  }
}

.forum-list,
.post-list {
  padding: 30px;
  border-radius: 12px;
}

.forum-list h2,
.post-list h2 {
  font-size: 1.8em;
  color: #34495e;
  margin-top: 0;
  margin-bottom: 25px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.forum-list ul {
  list-style: none;
  padding: 0;
}

.forum-list ul li {
  margin-bottom: 10px;
}

.forum-list ul li a,
.forum-list ul li.coming-soon {
  display: block;
  padding: 12px 15px;
  text-decoration: none;
  color: #555;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  transition:
    background-color 0.3s ease,
    color 0.3s ease;
  font-weight: 500;
}

.forum-list ul li a:hover {
  background-color: rgba(0, 123, 255, 0.1);
  color: #007bff;
}

.forum-list ul li.coming-soon {
  color: #999;
  font-style: italic;
  cursor: not-allowed;
  background-color: rgba(0, 0, 0, 0.01);
  opacity: 0.7;
}

.search-and-write {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-input {
  flex-grow: 1;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1em;
  outline: none;
  transition: border-color 0.3s ease;
}

.search-input:focus {
  border-color: #007bff;
}

.write-post-button {
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

.write-post-button:hover {
  background-color: #218838;
}

.posts {
  list-style: none;
  padding: 0;
}

.post-item {
  margin-bottom: 12px;
  background-color: rgba(255, 255, 255, 0.4);
  padding: 15px 20px;
  border-radius: 8px;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
}

.post-item:hover {
  background-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-3px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.post-link {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: #333;
}

.post-title {
  font-size: 1.1em;
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
  margin-right: 8px;
}

.no-posts {
  text-align: center;
  color: #888;
  padding: 30px;
  font-style: italic;
}

.view-all-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  text-decoration: none;
  font-weight: bold;
  margin-top: 20px;
  transition: background-color 0.3s ease;
}

.view-all-button:hover {
  background-color: #0056b3;
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
