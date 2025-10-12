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
          <li v-for="cat in categories" :key="cat.id">
            <router-link :to="`/community/${cat.id}`">{{ cat.name }}</router-link>
          </li>
        </ul>
      </section>
      
      <section class="post-list card glassmorphism">
         <router-view :key="$route.fullPath"></router-view>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// ref를 사용하여 카테고리 목록을 반응형 데이터로 관리
const categories = ref([
  { id: 'notices', name: '공지사항' },
  { id: 'requests', name: '구독/등급 입금승인요청' },
  { id: 'bugs', name: '버그 알리기' },
  { id: 'freeboard', name: '자유게시판' }, // 자유게시판 추가
  { id: 'nft-bids', name: 'NFT 입찰 정보' },
  { id: 'equity-info', name: '지분 공지 정보' },
  { id: 'salt-tech', name: '소금 기술 이야기' },
  { id: 'solein-tech', name: '스마트 솔레인 테크' },
  { id: 'deep-sea-water', name: '해양 심층수' },
]);
</script>

<style scoped>
.community-page {
  padding: 20px;
  max-width: 1200px;
  margin: 70px auto 40px; /* 상단 navbar와의 간격 확보 */
}
.page-header {
  text-align: center;
  margin-bottom: 40px;
}
.page-header h1 {
  font-size: 2.5em;
  color: #333;
  margin-bottom: 10px;
}
.page-header .description {
  font-size: 1.1em;
  color: #666;
}
.community-main {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 30px;
  align-items: flex-start;
}
@media (max-width: 992px) {
  .community-main {
    grid-template-columns: 1fr;
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
.forum-list h2 {
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
  margin: 0;
}
.forum-list ul li {
  margin-bottom: 10px;
}
.forum-list ul li a {
  display: block;
  padding: 12px 15px;
  text-decoration: none;
  color: #555;
  background-color: #f8f9fa;
  border-radius: 8px;
  transition:
    background-color 0.3s ease,
    color 0.3s ease,
    transform 0.2s ease;
  font-weight: 500;
  border-left: 3px solid transparent;
}
.forum-list ul li a:hover {
  background-color: #e9ecef;
  transform: translateX(3px);
}
.forum-list ul li a.router-link-active { /* 현재 활성화된 링크 스타일 */
  background-color: #e7f1ff;
  color: #007bff;
  font-weight: bold;
  border-left-color: #007bff;
}
.card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.08);
  border: 1px solid #e9ecef;
}
</style>