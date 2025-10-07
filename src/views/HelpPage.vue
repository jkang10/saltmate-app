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
    id: 'dashboard-menus',
    title: '대시보드 메뉴 안내',
    content: `
      <p>대시보드에서는 솔트메이트의 모든 기능으로 빠르게 이동할 수 있습니다. 각 메뉴의 기능은 다음과 같습니다.</p>
      
      <h4 class="menu-category">주요 활동 및 보상</h4>
      <ul>
        <li><strong>출석체크:</strong> 매일 접속하여 SaltMate 포인트와 특별 쿠폰 보상을 받는 공간입니다. 연속으로 출석하면 더 큰 보상을 받을 수 있습니다.</li>
        <li><strong>센터 방문 QR 인증:</strong> 오프라인 센터에 방문하여 비치된 QR코드를 스캔하고 보너스 SaltMate 포인트를 획득하는 기능입니다.</li>
        <li><strong>이벤트 공간:</strong> 관리자가 발급한 각종 쿠폰(채굴 부스트, 게임 아이템 등)의 현황을 확인하고 사용할 수 있습니다.</li>
      </ul>

      <h4 class="menu-category">자산 및 수익 관리</h4>
      <ul>
        <li><strong>내 수익 현황:</strong> 기간별, 종류별(투자 수익, 게임 보상 등) 수익 내역을 그래프와 목록으로 상세하게 분석하고 확인할 수 있습니다.</li>
        <li><strong>보유 토큰 현황:</strong> COBS, BND, SSC 등 보유하고 있는 토큰의 수량과 현재 가치를 확인할 수 있습니다.</li>
        <li><strong>나의 추천 네트워크:</strong> 내가 추천한 회원과 그 하위 라인을 시각적인 트리 형태로 보여주어, 나의 네트워크가 얼마나 확장되었는지 한눈에 파악할 수 있습니다.</li>
        <li><strong>지분 정보:</strong> 회사의 특정 자산(예: 공장)에 대한 나의 지분 현황과 관련 정보를 확인할 수 있습니다.</li>
        <li><strong>NFT 마켓플레이스:</strong> 보유한 NFT를 확인하고, 등급에 따른 특별한 멤버십 혜택을 누릴 수 있는 공간입니다.</li>
      </ul>

      <h4 class="menu-category">상점 및 거래</h4>
      <ul>
        <li><strong>솔트메이트 몰:</strong> SaltMate 포인트를 사용하여 실물 상품이나 특별한 디지털 아이템을 구매할 수 있는 상점입니다.</li>
        <li><strong>주간 경매:</strong> 매주 새롭게 진행되는 경매에 참여하여 희귀 아이템을 최고가로 낙찰받을 수 있는 경쟁 콘텐츠입니다.</li>
        <li><strong>소금 상인:</strong> 실시간으로 변동하는 '소금(SALT)' 시세에 맞춰 SaltMate 포인트로 소금을 사거나 팔아 차익을 노릴 수 있는 거래소입니다.</li>
      </ul>
      
      <h4 class="menu-category">게임 존: 성장 및 경영</h4>
      <ul>
        <li><strong>소금 광산:</strong> 소금을 채굴하고, 채굴기, 드릴 등 장비를 업그레이드하여 생산량을 늘리는 경영 시뮬레이션 게임입니다. 채굴한 소금은 SaltMate 포인트로 교환할 수 있습니다.</li>
        <li><strong>해양심층수 탐험:</strong> 심층수를 채집하고 장비를 업그레이드하여 자금을 모으는 게임입니다. 희귀 자원을 발견하여 더 큰 수익을 낼 수 있습니다.</li>
        <li><strong>나만의 소금 결정 키우기:</strong> 매일 물주기, 햇볕쬐기 등 활동을 통해 자신만의 소금 결정을 최종 단계까지 성장시키는 육성 게임입니다. 최종 단계에서 큰 보상을 받을 수 있습니다.</li>
        <li><strong>아이템 강화:</strong> SaltMate를 소모하여 아이템의 강화 레벨을 높이는 콘텐츠입니다. 강화 레벨이 높을수록 특별한 혜택을 받을 수 있습니다.</li>
      </ul>

      <h4 class="menu-category">게임 존: 퍼즐 및 대전</h4>
      <ul>
        <li><strong>솔트팡:</strong> 같은 모양의 보석을 3개 이상 맞춰 터뜨리는 클래식 매치-3 퍼즐 게임입니다.</li>
        <li><strong>솔트팡 1 vs 1 대전:</strong> 다른 사용자와 실시간으로 솔트팡 대결을 펼쳐 승리 보상을 획득하는 PvP(Player vs Player) 콘텐츠입니다.</li>
        <li><strong>숨은그림찾기:</strong> 제한 시간 내에 복잡한 그림 속에 숨겨진 특정 물건들을 모두 찾아내는 게임입니다.</li>
      </ul>

      <h4 class="menu-category">게임 존: 베팅 및 미니게임</h4>
      <ul>
        <li><strong>럭키 룰렛:</strong> 매일 한 번, 행운의 룰렛을 돌려 다양한 SaltMate 포인트 보상을 무작위로 획득하는 게임입니다.</li>
        <li><strong>보물상자 열기:</strong> 매일 한 번, 보물 상자를 열어 SaltMate 포인트를 획득하는 간단한 보상형 게임입니다.</li>
        <li><strong>소금 항아리:</strong> SaltMate 포인트를 지불하고 항아리를 열어, 지불한 금액보다 더 큰 보상을 노리는 뽑기형 게임입니다.</li>
        <li><strong>사다리타기:</strong> 원하는 시작점을 선택하여 운에 따라 다양한 보상을 획득하는 클래식 사다리타기 게임입니다.</li>
        <li><strong>하이로우:</strong> 제시된 숫자보다 다음 숫자가 높을지(High) 낮을지(Low) 예측하는 간단한 베팅 게임입니다.</li>
        <li><strong>가위바위보:</strong> 컴퓨터를 상대로 가위바위보 대결을 펼쳐 승리 시 보상을 받는 게임입니다.</li>
        <li><strong>랭킹 예측:</strong> '솔트팡 랭킹전'의 최종 순위(1~3위)를 예측하여 베팅하고, 예측 성공 시 높은 배당률의 보상을 받는 콘텐츠입니다.</li>
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
.help-page { padding: 20px; max-width: 1200px; margin: 70px auto; }
.page-header { text-align: center; margin-bottom: 40px; }
.page-header h1 { font-size: 2.2em; }
.help-container { display: flex; gap: 30px; }
.help-nav {
  position: sticky;
  top: 90px;
  width: 220px; /* 너비 약간 증가 */
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
  border-left: 3px solid transparent; /* 활성 상태 표시를 위함 */
}
.help-nav a:hover { background-color: #e9ecef; }
.help-nav a.active {
  background-color: #e7f1ff;
  color: #0056b3;
  font-weight: bold;
  border-left-color: #007bff;
}
.help-content { flex: 1; }
.help-content section { margin-bottom: 30px; padding: 30px; }
.help-content h2 { margin-top: 0; padding-bottom: 15px; border-bottom: 2px solid #eee; }
.help-content ul { padding-left: 20px; line-height: 1.8; }
.help-content li { margin-bottom: 12px; }
/* [핵심 추가] 메뉴 카테고리 제목 스타일 */
.help-content .menu-category {
  margin-top: 25px;
  margin-bottom: 15px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e9ecef;
  font-size: 1.3em;
  color: #333;
}
@media (max-width: 768px) {
  .help-container { flex-direction: column; }
  .help-nav { position: static; width: 100%; margin-bottom: 20px; }
  .help-nav ul { display: flex; flex-wrap: wrap; gap: 10px; }
  .help-nav a { border-left: none; border-bottom: 3px solid transparent; }
}
</style>