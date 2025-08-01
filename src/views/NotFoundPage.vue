<template>
  <div class="not-found-page">
    <div class="content">
      <h1>404</h1>
      <h2>페이지를 찾을 수 없습니다.</h2>
      <p>
        죄송합니다. 요청하신 페이지를 찾을 수 없습니다. 주소를 다시 확인하거나
        홈으로 돌아가주세요.
      </p>
      <router-link to="/" class="home-button">홈으로 돌아가기</router-link>
    </div>
  </div>
</template>

<script>
export default {
  name: "NotFoundPage",
};
</script>

<style scoped>
.not-found-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f8f9fa; /* 밝은 배경 */
  font-family: "Pretendard", sans-serif;
  color: #333;
  text-align: center;
}

.content {
  background-color: #ffffff;
  padding: 50px;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  max-width: 600px;
  margin: 20px;
}

h1 {
  font-size: 6em;
  color: #e74c3c; /* 에러를 나타내는 색상 */
  margin-bottom: 10px;
  text-shadow: 3px 3px 5px rgba(0, 0, 0, 0.05);
}

h2 {
  font-size: 2.5em;
  color: #34495e;
  margin-bottom: 20px;
}

p {
  font-size: 1.1em;
  color: #666;
  margin-bottom: 30px;
  line-height: 1.6;
}

.home-button {
  background-color: #3498db;
  color: white;
  padding: 15px 30px;
  border: none;
  border-radius: 8px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  text-decoration: none;
  transition:
    background-color 0.3s ease,
    transform 0.2s ease;
}

.home-button:hover {
  background-color: #2980b9;
  transform: translateY(-3px);
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.15);
}

/* 반응형 디자인 */
@media (max-width: 768px) {
  h1 {
    font-size: 4em;
  }
  h2 {
    font-size: 2em;
  }
  p {
    font-size: 1em;
  }
  .content {
    padding: 30px;
  }
  .home-button {
    padding: 12px 25px;
    font-size: 1em;
  }
}
</style>
