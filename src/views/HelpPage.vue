<template>
  <div class="help-page">
    <header class="page-header">
      <h1><i class="fas fa-question-circle"></i> 도움말</h1>
      <p>솔트메이트의 다양한 기능과 게임 규칙을 알아보세요.</p>
    </header>

    <div class="help-container">
      <nav class="help-nav">
        <ul>
          <li v-for="section in sections" :key="section.id">
            <a :href="'#' + section.id" @click.prevent="scrollTo(section.id)" :class="{ active: activeSection === section.id }">{{ section.title }}</a>
          </li>
        </ul>
      </nav>

      <main class="help-content">
        <section v-for="section in sections" :key="section.id" :id="section.id" class="card">
          <h2>{{ section.title }}</h2>
          <div v-html="section.content"></div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const activeSection = ref('introduction');

const sections = ref([
  {
    id: 'introduction',
    title: '솔트메이트란?',
    content: `
      <p>솔트메이트는 회원의 기여에 따라 수익을 분배받는 투자 플랫폼이자, 다양한 미니게임을 통해 즐거움과 보상을 얻을 수 있는 엔터테인먼트 공간입니다.</p>
      <h4>주요 재화</h4>
      <ul>
        <li><strong>SaltMate 포인트:</strong> 사이트 내 모든 활동의 기반이 되는 포인트입니다. 게임 참여, 아이템 구매 등에 사용됩니다.</li>
        <li><strong>Cash 잔액:</strong> 투자 수익의 일부가 적립되는 현금성 잔액으로, 출금이 가능합니다.</li>
        <li><strong>소금(SALT):</strong> '소금 상인' 메뉴에서 시세에 따라 SaltMate 포인트와 교환할 수 있는 실시간 자산입니다.</li>
      </ul>
    `
  },
  {
    id: 'game-ladder',
    title: '사다리타기',
    content: `
      <p>100 SaltMate를 지불하고 1~5번 중 원하는 시작점을 선택하여 참여하는 운试 게임입니다.</p>
      <ul>
        <li><strong>참여 방법:</strong> 시작점을 선택하고 '결과 확인하기' 버튼을 누릅니다.</li>
        <li><strong>보상:</strong> 사다리를 타고 내려가 도착한 지점에 표시된 SaltMate 포인트를 획득합니다. '꽝'이 나올 수도 있습니다.</li>
        <li><strong>일일 제한:</strong> 하루에 20번까지 참여할 수 있습니다.</li>
      </ul>
    `
  },
  {
    id: 'game-crystal',
    title: '소금 결정 키우기',
    content: `
      <p>매일 꾸준히 활동하여 자신만의 소금 결정을 최종 단계까지 성장시키는 게임입니다.</p>
      <ul>
        <li><strong>성장 방법:</strong> '물 주기', '햇볕 쬐기', '미네랄 주기' 활동을 매일 한 번씩 수행하여 성장 포인트를 얻습니다.</li>
        <li><strong>레벨업:</strong> 성장 포인트가 가득 차면 결정의 레벨이 오르며 모습이 변합니다. 최종 5단계까지 성장시킬 수 있습니다.</li>
        <li><strong>최종 보상:</strong> 5단계에 도달한 결정은 '수확'하여 대량의 SaltMate를 얻거나, '명예의 결정'으로 제작하여 명예의 결정실에 영구히 전시할 수 있습니다.</li>
      </ul>
    `
  },
  {
    id: 'earning-points',
    title: '재화 획득 방법',
    content: `
      <p>SaltMate 포인트는 다음과 같은 다양한 방법으로 획득할 수 있습니다.</p>
      <ul>
        <li><strong>투자 수익:</strong> 주간 정산을 통해 투자 등급에 따른 수익의 일부가 SaltMate 포인트로 지급됩니다.</li>
        <li><strong>게임 보상:</strong> 사다리타기, 솔트팡, 하이로우 등 각종 미니게임에서 승리하여 획득할 수 있습니다.</li>
        <li><strong>랭킹 보상:</strong> 일간/주간 랭킹에서 상위권에 오르면 보너스 포인트를 받습니다.</li>
        <li><strong>출석 체크:</strong> 매일 출석하여 포인트를 받고, 연속 출석 시 더 큰 보상을 받을 수 있습니다.</li>
        <li><strong>이벤트 및 쿠폰:</strong> 관리자가 지급하는 쿠폰이나 특별 이벤트를 통해 획득할 수 있습니다.</li>
      </ul>
    `
  }
]);

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

// 스크롤 위치에 따라 현재 활성화된 섹션을 감지하는 로직
const handleScroll = () => {
  const scrollPosition = window.scrollY + 150;
  for (let i = sections.value.length - 1; i >= 0; i--) {
    const section = sections.value[i];
    const el = document.getElementById(section.id);
    if (el && el.offsetTop <= scrollPosition) {
      activeSection.value = section.id;
      break;
    }
  }
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});

</script>

<style scoped>
.help-page { padding: 20px; max-width: 1200px; margin: 0 auto; }
.page-header { text-align: center; margin-bottom: 40px; }
.page-header h1 { font-size: 2.2em; }
.help-container { display: flex; gap: 30px; }
.help-nav {
  position: sticky;
  top: 90px; /* Navbar height + margin */
  width: 200px;
  align-self: flex-start;
}
.help-nav ul { list-style: none; padding: 0; margin: 0; }
.help-nav a {
  display: block;
  padding: 10px 15px;
  text-decoration: none;
  color: #555;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s;
}
.help-nav a:hover { background-color: #e9ecef; }
.help-nav a.active {
  background-color: #007bff;
  color: white;
  font-weight: bold;
}
.help-content { flex: 1; }
.help-content section { margin-bottom: 30px; padding: 25px; }
.help-content h2 { margin-top: 0; padding-bottom: 10px; border-bottom: 2px solid #eee; }
.help-content ul { padding-left: 20px; }
.help-content li { margin-bottom: 10px; }
@media (max-width: 768px) {
  .help-container { flex-direction: column; }
  .help-nav { position: static; width: 100%; margin-bottom: 20px; }
  .help-nav ul { display: flex; flex-wrap: wrap; gap: 10px; }
}
</style>