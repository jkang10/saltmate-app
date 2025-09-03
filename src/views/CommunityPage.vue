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
          <li><router-link to="/community/notices">공지사항</router-link></li>
          <li><router-link to="/community/payment_requests">구독/등급 입금승인요청</router-link></li>
          <li><router-link to="/community/bug_reports">버그 알리기</router-link></li>
          <li>
            <router-link to="/community/nft-bids">NFT 입찰 정보</router-link>
          </li>
          <li>
            <router-link to="/community/equity-info"
              >지분 공지 정보</router-link
            >
          </li>
          <li>
            <router-link to="/community/salt-tech"
              >소금 기술 이야기</router-link
            >
          </li>
          <li>
            <router-link to="/community/solein-tech"
              >스마트 솔레인 테크</router-link
            >
          </li>
          <li>
            <router-link to="/community/deep-sea-water"
              >해양 심층수</router-link
            >
          </li>
        </ul>
      </section>
      
      <section class="post-list card glassmorphism">
         <router-view :key="$route.fullPath"></router-view>
      </section>
    </main>
  </div>
</template>

<script>
// [수정] setup 스크립트를 제거하여 단순 템플릿 컴포넌트로 변경
// 이제 각 게시판의 로직은 자식 라우트 컴포넌트(BoardPage.vue 등)에서 처리합니다.
export default {
  name: "CommunityPage",
};
</script>

<style scoped>
/* (기존 스타일과 동일) */
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
  grid-template-columns: 250px 1fr;
  gap: 30px;
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
.forum-list ul li a:hover,
.forum-list ul li a.router-link-exact-active { /* 현재 활성화된 링크 스타일 */
  background-color: rgba(0, 123, 255, 0.1);
  color: #007bff;
  font-weight: bold;
}
.card {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}
</style>