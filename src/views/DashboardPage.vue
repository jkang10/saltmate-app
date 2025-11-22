<template>
  <div>
    <OnboardingTutorial :run="shouldRunTutorial" @complete="onTutorialComplete" />

   <div class="dashboard-container" style="padding-top: 0; gap: 0;">
      <DailyQuestsWidget />
      <section v-if="latestJackpotWinner" class="jackpot-winner-card card">
        <p>
          <i class="fas fa-trophy"></i>
          축하합니다! <strong>{{ latestJackpotWinner.userName }}</strong> 님께서 솔트팡 잭팟
          <strong>{{ latestJackpotWinner.amount.toLocaleString() }} SaltMate</strong>에 당첨되셨습니다!
        </p>
      </section>
      <section v-if="notices.length > 0" class="notice-section card">
        <div class="notice-header">
          <h3><i class="fas fa-bullhorn"></i> 공지사항</h3>
          <router-link to="/community/notices" class="more-link">더보기</router-link>
        </div>
        <ul class="notice-list">
          <li v-for="notice in notices" :key="notice.id">
            <router-link :to="`/community/post/${notice.id}`" class="notice-link">
              <span class="notice-title">{{ notice.title }}</span>
              <span class="notice-date">{{ formatDate(notice.createdAt) }}</span>
            </router-link>
          </li>
        </ul>
      </section>

      <main class="dashboard-content">
	<section class="performance-card card user-info-widget">
          <div class="card-header">
            <h3><i class="fas fa-crown"></i> 나의 등급 및 수익 현황</h3>
            <span :class="['tier-badge', getTierClass(userProfile?.tier)]">{{ userProfile?.tier }}</span>
          </div>
          <div class="investment-info">
            <span>나의 구독 원금</span>
            <strong>{{ (userProfile?.investmentAmount || 0).toLocaleString() }} 원</strong>
          </div>
          <div class="performance-body">
            <h4>
              수익 사이클 ({{ cycleProgress.toFixed(1) }}% / {{ (marketingPlan?.cycleCapMultiplier || 3) * 100 }}%)
            </h4>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" :style="{ width: cycleProgress + '%' }">
                <i class="fas fa-running running-man"></i>
              </div>
            </div>
            <div class="progress-labels">
              <span class="current-earnings clickable" @click="openCycleEarningsModal">
                {{ (userProfile?.currentCycleEarnings || 0).toLocaleString() }} 원
              </span>
              <span class="cycle-cap">
                달성 목표: {{ (userProfile?.cycleCap || 0).toLocaleString() }} 원
              </span>
            </div>
          </div>
          <div class="balances">
            <div class="balance-item cash" @click="openHistoryModal('CASH')">
              <label><i class="fas fa-wallet"></i> 현금성 수익</label>
              <span>{{ (userProfile?.cashBalance || 0).toLocaleString() }}</span>
              <small>원</small>
              <div class="withdrawal-action">
                <button class="withdrawal-button" :disabled="!isWithdrawalEnabled" @click.stop="openWithdrawalModal">
                  출금 신청하기
                </button>
                <small v-if="!isWithdrawalEnabled" class="withdrawal-notice">
                  신청 가능 시간: 매주 화 09:00-17:00
                </small>
              </div>
            </div>
            <div class="balance-item saltmate" @click="openHistoryModal('SALTMATE')">
              <div class="balance-content">
                <div class="balance-label">
                  <i class="fas fa-gifts"></i> 솔트메이트
                </div>
                <div class="balance-value">
                  {{ (userProfile?.saltmatePoints || 0).toLocaleString() }}
                </div>
                <div class="balance-unit">SaltMate</div>
              </div>
              <div class="shimmer-effect"></div>
            </div>
          </div>

          <div class="subscription-status-card" :class="subscriptionStatusClass">
            <div class="status-header">
              <i class="fas fa-calendar-alt"></i>
              <h4>월간 구독 현황</h4>
            </div>
            <div v-if="!userProfile?.nextPaymentDueDate">
              <p>구독 정보 로딩 중...</p>
            </div>
            <div v-else-if="userProfile?.subscriptionStatus === 'active'">
              <p>
                다음 결제일까지 <strong>{{ daysUntilPayment }}일</strong> 남았습니다.
              </p>
              <button @click="requestPayment" class="btn-pay" :disabled="isRequestingPayment">
                <span v-if="isRequestingPayment" class="spinner-small"></span>
                <span v-else>월간 구독 미리 결제하기</span>
              </button>
            </div>
            <div v-else-if="userProfile?.subscriptionStatus === 'overdue'">
              <p><strong>결제일이 지났습니다.</strong></p>
              <p class="warning-text">
                일부 기능이 제한됩니다. 지금 바로 결제해주세요.
              </p>
              <button @click="requestPayment" class="btn-pay urgent" :disabled="isRequestingPayment">
                <span v-if="isRequestingPayment" class="spinner-small"></span>
                <span v-else>지금 결제하기</span>
              </button>
            </div>
          </div>
          <div class="upgrade-action">
            <button @click="openUpgradeModal" class="upgrade-button" :disabled="userProfile?.tier === '승인대기중'">
              <i class="fas fa-arrow-up"></i> 등급 추가 구매
            </button>
          </div>
        </section>

        <div class="dashboard-grid">
	  <LiveGameFeed class="live-feed-widget" />
          <LeaderboardWidget />
          <WeeklyLeaderboardWidget />
          <SaltPangHallOfFame />
	  <SaltMinePrestigeRankingsWidget />
	  <SaltMineClickRankingsWidget />
          <ChallengeRankingsWidget />
          <SaltPangRankedWidget />
	  <SaltPangPvpRankingsWidget />
	  <EnchantRankingsWidget />
	  <SaltAlchemyRankingsWidget />
	  <SaltAlchemyWeeklyRankingsWidget />
	  <WeeklyGoldRankingWidget />
	  <TotalGoldRankingWidget />
	  <SaltBlockPuzzleRankingsWidget />
	  <AvatarShowcaseWidget class="avatar-showcase" />
	  <SaltGuardiansRankingsWidget />
	  <SaltBubbleRankingsWidget />
	  <SaltStepRankingsWidget />
          <router-link to="/mall" class="feature-card mall">
            <div class="card-icon"><i class="fas fa-store"></i></div>
            <h3>솔트메이트 몰</h3>
            <p>솔트메이트 포인트로 특별한 상품을 구매하세요.</p>
            <span class="card-enter">둘러보기 &rarr;</span>
          </router-link>
          <router-link to="/claim-code" class="feature-card">
            <div class="card-icon"><i class="fas fa-ticket-alt"></i></div>
            <h3>쿠폰 / 코드 등록</h3>
            <p>이벤트나 상품 구매로 받은 코드를 입력하고 보상을 받으세요.</p>
            <span class="card-enter">등록하기 &rarr;</span>
          </router-link>
          <router-link to="/attendance" class="feature-card events">
            <div class="card-icon"><i class="fas fa-calendar-check"></i></div>
            <h3>매일매일 출석체크</h3>
            <p>매일 접속하여 SaltMate와 특별한 쿠폰 보상을 받으세요!</p>
            <span class="card-enter">참여하기 &rarr;</span>
          </router-link>
          <router-link to="/qr-scanner" class="feature-card qr-scanner">
            <div class="card-icon"><i class="fas fa-qrcode"></i></div>
            <h3>센터 방문 QR 인증</h3>
            <p>센터에 방문하여 QR코드를 스캔하고 1,000 SaltMate를 획득하세요!</p>
            <span class="card-enter">인증하기 &rarr;</span>
          </router-link>
          <router-link to="/my-tokens" class="feature-card tokens">
            <div class="card-icon"><i class="fas fa-coins"></i></div>
            <h3>보유 토큰 현황</h3>
            <p>COBS, BND, SSC 토큰의 수량과 가치를 확인하세요.</p>
            <div class="token-glance">
              <div class="token-item">
                <img src="@/assets/COBS.png" alt="COBS" />
                <span>{{ (userProfile?.tokens?.cobs || 0).toLocaleString() }}</span>
              </div>
              <div class="token-item">
                <img src="@/assets/BND_LOGO.png" alt="BND" />
                <span>{{ (userProfile?.tokens?.bnd || 0).toLocaleString() }}</span>
              </div>
              <div class="token-item">
                <img src="@/assets/SSC_LOGO.png" alt="SSC" />
                <span>{{ (userProfile?.tokens?.ssc || 0).toLocaleString() }}</span>
              </div>
            </div>
            <span class="card-enter">자세히 보기 &rarr;</span>
          </router-link>
          <router-link to="/nft-marketplace" class="feature-card nft">
            <div class="card-icon"><i class="fas fa-gem"></i></div>
            <h3>NFT 마켓플레이스</h3>
            <p>보유한 NFT를 확인하고 멤버십 혜택을 누리세요.</p>
            <span class="card-enter">입장하기 &rarr;</span>
          </router-link>
          <router-link to="/my-assets" class="feature-card" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white;">
            <div class="card-icon" style="color: white;"><i class="fas fa-wallet"></i></div>
            <h3>나의 통합 자산</h3>
            <p style="color: white; opacity: 0.9;">포인트, 게임 재화, 토큰, 쿠폰 등 모든 자산을 한눈에 확인하세요.</p>
            <span class="card-enter" style="color: white;">자세히 보기 &rarr;</span>
          </router-link>
	<router-link to="/my-avatar" class="feature-card"> <div class="card-icon"><i class="fas fa-user-astronaut"></i></div>
	  <h3>내 아바타 꾸미기</h3>
	  <p>나만의 아바타를 만들어 '솔레인 디지털 유니버스'의 주인공이 되어보세요!</p>
	  <span class="card-enter">꾸미러 가기 &rarr;</span>
	</router-link>
	<router-link to="/metaverse-portal" class="feature-card metaverse-portal-card">
	  <div class="card-icon"><i class="fas fa-vr-cardboard"></i></div>
	  <h3>솔레인 디지털 유토피아</h3>
	  <p>가상현실 테마파크! 곧 열릴 새로운 세계를 미리 만나보세요.</p>
	  <span class="card-enter">미리보기 &rarr;</span>
	</router-link>

	<TokenMineCard />
	  <router-link to="/staking" class="feature-card staking">
            <div class="card-icon"><i class="fas fa-piggy-bank"></i></div>
            <h3>SaltMate 정기예금</h3>
            <p>SaltMate를 예치하고 이자를 받아보세요.</p>
            <span class="card-enter">예치하기 &rarr;</span>
          </router-link>
         <router-link to="/crafting" class="feature-card crafting-workshop-card">
          <div class="card-icon"><i class="fas fa-hammer"></i></div>
          <h3>솔레인 제작 공방</h3>
          <p>게임을 통해 모은 재료로 특별한 아이템을 직접 만들어보세요!</p>
          <span class="card-enter">입장하기 &rarr;</span>
        </router-link>
          <router-link to="/network-tree" class="feature-card">
            <div class="card-icon"><i class="fas fa-sitemap"></i></div>
            <h3>나의 추천 네트워크</h3>
            <p>나의 하위 추천 라인을 시각적으로 확인합니다.</p>
            <span class="card-enter">확인하기 &rarr;</span>
          </router-link>
          <router-link to="/my-equity" class="feature-card equity">
            <div class="card-icon"><i class="fas fa-chart-pie"></i></div>
            <h3>지분 정보</h3>
            <p>나의 공장 지분 현황과 관련 정보를 확인합니다.</p>
            <span class="card-enter">확인하기 &rarr;</span>
          </router-link>
          <router-link to="/my-events" class="feature-card events">
            <div class="card-icon"><i class="fas fa-calendar-alt"></i></div>
            <h3>이벤트 공간</h3>
            <p>진행중인 다양한 이벤트에 참여하고 혜택을 받으세요.</p>
            <span class="card-enter">참여하기 &rarr;</span>
          </router-link>
          <router-link to="/my-investments" class="feature-card revenue">
            <div class="card-icon"><i class="fas fa-chart-line"></i></div>
            <h3>내 수익 현황</h3>
            <p>기간별, 종류별 수익 내역을 상세히 확인합니다.</p>
            <span class="card-enter">분석하기 &rarr;</span>
          </router-link>
          <router-link to="/game-zone" class="feature-card game">
            <div class="card-icon"><i class="fas fa-gamepad"></i></div>
            <h3>럭키 룰렛</h3>
            <p>매일 한 번, 행운의 룰렛을 돌리고 SaltMate 포인트를 획득하세요!</p>
            <span class="card-enter">게임 시작 &rarr;</span>
          </router-link>
	<router-link to="/treasure-box" class="feature-card card-glass treasure-card-enhanced" :class="{ 'is-fever': isFeverTime }">
	  
	  <div v-if="isFeverTime" class="fever-badge-mini">
	    <i class="fas fa-fire"></i> FEVER
	  </div>

	  <div class="card-content-wrapper">
	    <div class="chest-icon-container">
	      <img src="@/assets/chest_closed.png" alt="황금 상자" class="chest-icon-img">
	      <div class="glow-effect-mini"></div>
	    </div>

	    <div class="card-text">
	      <h3>전설의 황금 상자</h3>
	      <p>매일 터지는 잭팟! 꽝 없는 보물찾기에 도전하세요.</p>
	      <p v-if="isFeverTime" class="fever-alert">🔥 지금은 피버타임! 보상 확률 UP! 🔥</p>
	    </div>
	  </div>
	</router-link>
	  <router-link to="/ladder-game" class="feature-card game">
	    <div class="card-icon"><i class="fas fa-stream"></i></div>
	    <h3>사다리타기</h3>
	    <p>운명의 사다리를 타고 행운의 SaltMate를 획득하세요!</p>
	    <span class="card-enter">도전하기 &rarr;</span>
	  </router-link>
	  <router-link to="/salt-pot-gacha" class="feature-card treasure">
	    <div class="card-icon"><i class="fas fa-wine-bottle"></i></div>
	    <h3>소금 항아리</h3>
	    <p>매일 한 번, 항아리를 열고 대박 포인트를 노려보세요!</p>
	    <span class="card-enter">열어보기 &rarr;</span>
	  </router-link>
          <router-link to="/high-low-game" class="feature-card game">
            <div class="card-icon">
              <i class="fas fa-arrow-up"></i><i class="fas fa-arrow-down"></i>
            </div>
            <h3>하이로우</h3>
            <p>다음 숫자가 높을지 낮을지 예측하고 SaltMate를 획득하세요!</p>
            <span class="card-enter">도전하기 &rarr;</span>
          </router-link>
          <router-link to="/rps-game" class="feature-card game">
            <div class="card-icon"><i class="fas fa-hand-scissors"></i></div>
            <h3>가위바위보</h3>
            <p>컴퓨터를 상대로 가위바위보에서 승리하고 SaltMate를 획득하세요!</p>
            <span class="card-enter">게임 시작 &rarr;</span>
          </router-link>
          <router-link to="/salt-game" class="feature-card salt-game">
            <div class="card-icon"><i class="fas fa-gem"></i></div>
            <h3>소금 결정 키우기</h3>
            <p>결정을 클릭하여 키우고 SaltMate 포인트를 수확하세요!</p>
            <span class="card-enter">플레이 &rarr;</span>
          </router-link>
          <router-link to="/salt-mine-game" class="feature-card salt-mine-game">
            <div class="card-icon"><i class="fas fa-gem"></i></div>
            <h3>소금 광산</h3>
            <p>소금을 채굴하고 업그레이드하여 SaltMate 포인트를 획득하세요!</p>
            <span class="card-enter">입장하기 &rarr;</span>
          </router-link>
          <router-link to="/helia-game" class="feature-card helia-event">
            <div class="card-icon"><i class="fas fa-box-open"></i></div>
            <h3>헬리아 미니게임</h3>
            <p>헬리아 소금을 포장하고 SaltMate와 쿠폰을 받으세요!</p>
            <span class="card-enter">참여하기 &rarr;</span>
          </router-link>
          <router-link to="/deep-sea-game" class="feature-card deep-sea-game">
            <div class="card-icon"><i class="fas fa-water"></i></div>
            <h3>해양심층수 탐험</h3>
            <p>심층수를 채집하고 장비를 업그레이드하여 자금을 모으세요.</p>
            <span class="card-enter">탐험 시작 &rarr;</span>
          </router-link>
	<router-link to="/auction" class="feature-card game">
	  <div class="card-icon"><i class="fas fa-gavel"></i></div>
	  <h3>주간 경매</h3>
	  <p>최고가에 도전하여 희귀 아이템을 획득하세요!</p>
	  <span class="card-enter">입장하기 &rarr;</span>
	</router-link>
	<router-link to="/salt-trader" class="feature-card">
	  <div class="card-icon"><i class="fas fa-exchange-alt"></i></div>
	  <h3>소금 상인</h3>
	  <p>변동하는 시세에 맞춰 소금을 사고팔아 수익을 내보세요.</p>
	  <span class="card-enter">거래하기 &rarr;</span>
	</router-link>

	<router-link to="/enchanting" class="feature-card">
	  <div class="card-icon"><i class="fas fa-magic"></i></div>
	  <h3>아이템 강화</h3>
	  <p>SaltMate를 사용하여 아이템을 강화하고 더 강해지세요!</p>
	  <span class="card-enter">강화하기 &rarr;</span>
	</router-link>
          <router-link to="/salt-pang" class="feature-card game">
            <div class="card-icon"><i class="fas fa-puzzle-piece"></i></div>
            <h3>솔트팡</h3>
            <p>같은 모양의 소금 결정을 3개 이상 맞춰 포인트를 획득하세요!</p>
            <span class="card-enter">게임 시작 &rarr;</span>
          </router-link>
	<router-link to="/salt-pang-pvp" class="feature-card game pvp">
	  <div class="card-icon"><i class="fas fa-fist-raised"></i></div>
	  <h3>솔트팡 1 vs 1 대전</h3>
	  <p>다른 유저와 실시간으로 솔트팡 대결을 펼치고 승리 보상을 획득하세요!</p>
	  <span class="card-enter">대전 시작 &rarr;</span>
	</router-link>
	<router-link to="/hidden-object" class="feature-card game">
	  <div class="card-icon"><i class="fas fa-search"></i></div>
	  <h3>숨은그림찾기</h3>
	  <p>제한 시간 내에 숨겨진 그림을 모두 찾아보세요!</p>
	  <span class="card-enter">도전하기 &rarr;</span>
	</router-link>
	<router-link to="/salt-crystal-game" class="feature-card crystal-game">
	  <div class="crystal-aura-bg"></div>
	  <div class="crystal-icon-main">
	    <i class="fas fa-gem"></i>
	  </div>
	  <div class="card-content">
	    <h3>나만의 소금 결정 키우기</h3>
	    <p>매일 정성을 들여 당신만의 특별한 보석을 완성해보세요.</p>
	    <span class="card-enter">시작하기 &rarr;</span>
	  </div>
	</router-link>
	<router-link to="/salt-guardians" class="feature-card game">
	  <div class="card-icon"><i class="fas fa-shield-alt"></i></div>
	  <h3>솔트 가디언즈</h3>
	  <p>다가오는 위협으로부터 소금 결정을 지켜내세요!</p>
	  <span class="card-enter">도전하기 &rarr;</span>
	</router-link>
	<router-link to="/maze-game" class="feature-card game">
            <div class="card-icon"><i class="fas fa-dungeon"></i></div>
            <h3>수정 동굴 탈출</h3>
            <p>매일 바뀌는 미로를 탐험하고 숨겨진 보물을 찾아 탈출하세요!</p>
            <span class="card-enter">도전하기 &rarr;</span>
        </router-link>
        <router-link to="/snake-game" class="feature-card game">
          <div class="card-icon"><i class="fas fa-worm"></i></div>
          <h3>지렁이 게임</h3>
          <p>소금 결정을 먹고 꼬리가 닿기 전까지 최고 점수에 도전하세요!</p>
          <span class="card-enter">도전하기 &rarr;</span>
        </router-link>
	<router-link to="/frog-game" class="feature-card game">
	  <div class="card-icon"><i class="fas fa-frog"></i></div>
	  <h3>솔트 프로그</h3>
	  <p>광산 수레와 염수 강을 건너 소금 결정을 안전하게 획득하세요!</p>
	  <span class="card-enter">도전하기 &rarr;</span>
	</router-link>
	<router-link to="/salt-alchemy" class="feature-card alchemy game">
	  <div class="card-icon"><i class="fas fa-flask"></i></div>
	  <h3>솔트 알케미</h3>
	  <p>재료를 합쳐 새로운 아이템을 발견하고 '연금술 가루'를 획득하세요!</p>
	  <span class="card-enter">플레이 &rarr;</span>
	</router-link>
        <router-link to="/salt-block-puzzle" class="feature-card block-puzzle game">
        <div class="card-icon"><i class="fas fa-th-large"></i></div>
        <h3>솔트 블록 1010</h3>
        <p>블록으로 줄을 채워 점수를 획득하고 '연금술 가루'를 모으세요!</p>
        <span class="card-enter">플레이 &rarr;</span>
       </router-link>
       <router-link to="/walking-salt" class="feature-card walking-salt game">
        <div class="card-icon"><i class="fas fa-walking"></i></div>
        <h3>워킹 솔트</h3>
        <p>걸음 수를 인증하고 SaltMate 포인트를 획득하세요! (일일 1회)</p>
        <span class="card-enter">인증하기 &rarr;</span>
       </router-link>
	<router-link to="/salt-bubble" class="feature-card bubble-shooter game">
	  <div class="card-icon"><i class="fas fa-dot-circle"></i></div>
	  <h3>솔트 버블</h3>
	  <p>같은 색 결정 3개를 조준해 터뜨리고 콤보 보상을 획득하세요!</p>
	  <span class="card-enter">플레이 &rarr;</span>
	</router-link>
	<router-link to="/salt-step" class="feature-card step-game game">
	  <div class="card-icon"><i class="fas fa-shoe-prints"></i></div>
	  <h3>솔트 스텝</h3>
	  <p>타이밍에 맞춰 계단을 오르고 재화를 획득하세요! (원-터치)</p>
	  <span class="card-enter">플레이 &rarr;</span>
	</router-link>
	<router-link to="/scratch-lottery" class="feature-card game">
	  <div class="card-icon"><i class="fas fa-ticket-alt"></i></div>
	  <h3>행운의 복권</h3>
	  <p>손끝으로 긁어서 당첨을 확인하세요! 매일 5번의 기회!</p>
	  <span class="card-enter">긁으러 가기 &rarr;</span>
	</router-link>
	<router-link to="/salt-plinko" class="feature-card plinko-card">
	  <div class="card-icon"><i class="fas fa-water"></i></div>
	  <h3>황금 소금 폭포</h3>
	  <p>구슬이 떨어지며 운명을 결정합니다. 최대 100배 대박의 기회!</p>
	  <span class="card-enter">도전하기 &rarr;</span>
	</router-link>
	<router-link to="/quiz-game" class="feature-card game">
        <div class="card-icon"><i class="fas fa-question-circle"></i></div>
        <h3>솔트 스칼라 퀴즈</h3>
        <p>매시간 열리는 서바이벌 퀴즈쇼의 최후의 1인이 되어보세요!</p>
        <span class="card-enter">참여하기 &rarr;</span>
        </router-link>
        </div>
      </main>

      <TransactionHistoryModal
        v-if="historyModal.visible"
        :balanceType="historyModal.type"
        :currentBalance="
          historyModal.type === 'CASH'
            ? userProfile.cashBalance
            : userProfile.saltmatePoints
        "
        @close="historyModal.visible = false"
      />
      <UpgradeTierModal
        v-if="upgradeModalVisible"
        @close="upgradeModalVisible = false"
      />
      <WithdrawalRequestModal
        v-if="isWithdrawalModalVisible"
        :userProfile="userProfile"
        @close="isWithdrawalModalVisible = false"
      />
      <CycleEarningsModal
        v-if="isCycleModalVisible"
        @close="isCycleModalVisible = false"
      />
    </div>
  </div>
</template>

<script>
// [핵심] ref, onMounted, computed를 vue에서 직접 import합니다.
import { ref, onMounted, onUnmounted, computed } from "vue";
import { auth, db, functions } from "@/firebaseConfig";
import { httpsCallable, getFunctions } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
// ... (나머지 컴포넌트 import는 그대로 유지) ...
import TransactionHistoryModal from "@/components/TransactionHistoryModal.vue";
import UpgradeTierModal from "@/components/UpgradeTierModal.vue";
import WithdrawalRequestModal from "@/components/WithdrawalRequestModal.vue";
import CycleEarningsModal from "@/components/CycleEarningsModal.vue";
import LiveGameFeed from "@/components/LiveGameFeed.vue";
import LeaderboardWidget from "@/components/LeaderboardWidget.vue";
import WeeklyLeaderboardWidget from "@/components/WeeklyLeaderboardWidget.vue";
import SaltPangHallOfFame from "@/components/SaltPangHallOfFame.vue";
import ChallengeRankingsWidget from "@/components/ChallengeRankingsWidget.vue";
import SaltPangRankedWidget from "@/components/SaltPangRankedWidget.vue";
import EnchantRankingsWidget from '@/components/EnchantRankingsWidget.vue';
import SaltPangPvpRankingsWidget from '@/components/SaltPangPvpRankingsWidget.vue';
import SaltGuardiansRankingsWidget from '@/components/SaltGuardiansRankingsWidget.vue';
import OnboardingTutorial from '@/components/common/OnboardingTutorial.vue';
import SaltMinePrestigeRankingsWidget from '@/components/SaltMinePrestigeRankingsWidget.vue';
import SaltMineClickRankingsWidget from '@/components/SaltMineClickRankingsWidget.vue';
import DailyQuestsWidget from '@/components/DailyQuestsWidget.vue';
import TokenMineCard from '@/components/common/TokenMineCard.vue';
import WeeklyGoldRankingWidget from '@/components/WeeklyGoldRankingWidget.vue';
import TotalGoldRankingWidget from '@/components/TotalGoldRankingWidget.vue';
import AvatarShowcaseWidget from '@/components/common/AvatarShowcaseWidget.vue';
import SaltAlchemyRankingsWidget from "@/components/SaltAlchemyRankingsWidget.vue";
import SaltAlchemyWeeklyRankingsWidget from "@/components/SaltAlchemyWeeklyRankingsWidget.vue";
import SaltBlockPuzzleRankingsWidget from "@/components/SaltBlockPuzzleRankingsWidget.vue";
import SaltBubbleRankingsWidget from "@/components/SaltBubbleRankingsWidget.vue";
import SaltStepRankingsWidget from "@/components/SaltStepRankingsWidget.vue";

export default {
  name: "DashboardPage",
  components: {
    // ... (모든 컴포넌트 등록은 그대로 유지) ...
TransactionHistoryModal,
    UpgradeTierModal,
    WithdrawalRequestModal,
    CycleEarningsModal,
    LiveGameFeed,
    LeaderboardWidget,
    WeeklyLeaderboardWidget,
    SaltPangHallOfFame,
    ChallengeRankingsWidget,
    SaltPangRankedWidget,
    EnchantRankingsWidget,
    SaltPangPvpRankingsWidget,
    SaltGuardiansRankingsWidget,
    OnboardingTutorial,
    SaltMinePrestigeRankingsWidget,
    SaltMineClickRankingsWidget,
    DailyQuestsWidget,
    TokenMineCard,
    WeeklyGoldRankingWidget,
    TotalGoldRankingWidget,
    AvatarShowcaseWidget,
    SaltAlchemyRankingsWidget,
    SaltAlchemyWeeklyRankingsWidget,
    SaltBlockPuzzleRankingsWidget,
    SaltBubbleRankingsWidget,
    SaltStepRankingsWidget,
  },
  // [핵심] 기존의 data(), computed, methods, created(), unmounted()를 모두 setup() 함수 안으로 통합합니다.
  setup() {
    // --- 1. data()에 있던 변수들을 ref 또는 reactive로 변환 ---
    const userProfile = ref(null);

    // ▼▼▼ [★추가 1★] 여기에 다음 코드를 붙여넣으세요 ▼▼▼
    const isFeverTime = ref(false);
    let feverInterval = null;

    const checkFeverTime = () => {
      const now = new Date();
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstNow = new Date(now.getTime() + kstOffset);
      const currentHour = kstNow.getUTCHours();
      // 매일 저녁 20시 ~ 22시
      isFeverTime.value = currentHour >= 20 && currentHour < 22;
    };
    // ▲▲▲

    const loadingUser = ref(true);
    const error = ref(null);
    const notices = ref([]);
    const historyModal = ref({ visible: false, type: "" });
    const upgradeModalVisible = ref(false);
    const isWithdrawalModalVisible = ref(false);
    const isCycleModalVisible = ref(false);
    const marketingPlan = ref(null);
    const isRequestingPayment = ref(false);
    const latestJackpotWinner = ref(null);
    
    let unsubscribe = null;
    let unsubscribeJackpot = null;

    // --- 2. 튜토리얼 관련 상태 변수 추가 ---
    const shouldRunTutorial = ref(false);

    // --- 3. computed 속성 정의 ---
    const cycleProgress = computed(() => {
      if (!userProfile.value || !userProfile.value.cycleCap || userProfile.value.cycleCap === 0) return 0;
      return Math.min((userProfile.value.currentCycleEarnings / userProfile.value.cycleCap) * 100, 100);
    });

    const isWithdrawalEnabled = computed(() => {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      return day === 2 && hour >= 9 && hour < 17;
    });

    const daysUntilPayment = computed(() => {
      if (!userProfile.value?.nextPaymentDueDate) return "N/A";
      const dueDate = userProfile.value.nextPaymentDueDate.toDate();
      const today = new Date();
      dueDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    });

    const subscriptionStatusClass = computed(() => {
      if (!userProfile.value?.subscriptionStatus) return "";
      return `status-${userProfile.value.subscriptionStatus}`;
    });

    // --- 4. methods를 일반 함수로 정의 ---
    const listenToLatestJackpot = () => {
      const q = query(collection(db, "saltPangJackpotWins"), orderBy("wonAt", "desc"), limit(1));
      unsubscribeJackpot = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          latestJackpotWinner.value = snapshot.docs[0].data();
        }
      });
    };

    const requestPayment = async () => {
      if (!confirm("월간 구독료(만원의 행복) 결제를 요청하시겠습니까? 관리자 확인 후 승인 처리됩니다.")) return;
      isRequestingPayment.value = true;
      try {
        const requestMonthlyPayment = httpsCallable(functions, "requestMonthlyPayment");
        await requestMonthlyPayment();
        alert("결제 요청이 완료되었습니다. 관리자가 승인하면 구독 상태가 갱신됩니다.");
      } catch (e) {
        console.error("월간 결제 요청 오류:", e);
        alert(`오류가 발생했습니다: ${e.message}`);
      } finally {
        isRequestingPayment.value = false;
      }
    };

    const listenToUserProfile = (uid) => {
      loadingUser.value = true;
      const userRef = doc(db, "users", uid);
      unsubscribe = onSnapshot(userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            userProfile.value = docSnap.data();
            // [핵심] 사용자 프로필을 받은 후 튜토리얼 실행 여부 결정
            if (!userProfile.value.hasCompletedTutorial) {
              shouldRunTutorial.value = true;
            }
          } else {
            error.value = "사용자 프로필을 찾을 수 없습니다.";
          }
          loadingUser.value = false;
        },
        (e) => {
          console.error("프로필 실시간 수신 실패:", e);
          error.value = "프로필 로딩에 실패했습니다.";
          loadingUser.value = false;
        }
      );
    };

    const fetchMarketingPlan = async () => {
      const planRef = doc(db, "configuration", "marketingPlan");
      const docSnap = await getDoc(planRef);
      if (docSnap.exists()) {
        marketingPlan.value = docSnap.data();
      }
    };

    const fetchNotices = async () => {
      try {
        const q = query(collection(db, "posts"), where("category", "==", "notices"), orderBy("createdAt", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        notices.value = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error("공지사항 로딩 오류:", e);
      }
    };

    const formatDate = (timestamp) => {
      if (!timestamp?.toDate) return "";
      return timestamp.toDate().toLocaleDateString("ko-KR");
    };

    const getTierClass = (tier) => {
      if (!tier) return "default";
      if (tier === "승인대기중") return "pending";
      return tier.toLowerCase();
    };
    
    const openHistoryModal = (type) => {
      historyModal.value.type = type;
      historyModal.value.visible = true;
    };
    const openUpgradeModal = () => { upgradeModalVisible.value = true; };
    const openWithdrawalModal = () => { isWithdrawalModalVisible.value = true; };
    const openCycleEarningsModal = () => { isCycleModalVisible.value = true; };
    
    // --- 5. 튜토리얼 완료 처리 함수 ---
    const onTutorialComplete = async () => {
      shouldRunTutorial.value = false; // 튜토리얼 숨기기
      try {
        const functionsWithRegion = getFunctions(undefined, "asia-northeast3");
        const markComplete = httpsCallable(functionsWithRegion, 'markTutorialAsCompleted');
        await markComplete();
        // 로컬 userProfile 상태도 업데이트하여 새로고침 전까지 다시 보이지 않도록 함
        if(userProfile.value) userProfile.value.hasCompletedTutorial = true;
      } catch (e) {
        console.error("Failed to mark tutorial as complete:", e);
      }
    };

    // --- 6. created()와 unmounted()를 onMounted()와 onUnmounted()로 변환 ---
    onMounted(() => {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          listenToUserProfile(user.uid);
          fetchMarketingPlan();
          fetchNotices();
          listenToLatestJackpot();
        } else {
          loadingUser.value = false;
        }
      });
      // ▼▼▼ [★추가 2★] onMounted 함수의 맨 마지막 줄 직전에 추가하세요 ▼▼▼
      checkFeverTime();
      feverInterval = setInterval(checkFeverTime, 60000); // 1분마다 체크
      // ▲▲▲
    });

    onUnmounted(() => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeJackpot) unsubscribeJackpot();
      // ▼▼▼ [★추가 3★] 여기에 다음 코드를 붙여넣으세요 ▼▼▼
      if (feverInterval) clearInterval(feverInterval);
      // ▲▲▲
    });

    // --- 7. template에서 사용할 모든 변수와 함수를 return ---
    return {
      userProfile, loadingUser, error, notices, historyModal, upgradeModalVisible,
      isWithdrawalModalVisible, isCycleModalVisible, marketingPlan, isRequestingPayment,
      latestJackpotWinner,
      cycleProgress, isWithdrawalEnabled, daysUntilPayment, subscriptionStatusClass,
      requestPayment, formatDate, getTierClass, openHistoryModal, openUpgradeModal,
      openWithdrawalModal, openCycleEarningsModal,
      // 튜토리얼 관련
      shouldRunTutorial,
      onTutorialComplete,
      isFeverTime,
    };
  },
};
</script>

<style scoped>
/* 황금 소금 폭포 카드 스타일 */
.feature-card.plinko-card {
  background: linear-gradient(135deg, #1a2333 0%, #2c3e50 100%);
  border: 1px solid #FFD700;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
}
.feature-card.plinko-card .card-icon {
  color: #FFD700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
  animation: bounce 2s infinite;
}
.feature-card.plinko-card h3 {
  color: #FFD700;
}
.feature-card.plinko-card p {
  color: #bdc3c7;
}
.feature-card.plinko-card .card-enter {
  background: rgba(255, 215, 0, 0.2);
  color: #FFD700;
}
@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
  40% {transform: translateY(-10px);}
  60% {transform: translateY(-5px);}
}
/* ▼▼▼ [★핵심 추가★] "솔트 버블" 게임 카드 스타일 ▼▼▼ */
.feature-card.bubble-shooter.game {
  background: linear-gradient(135deg, #27ae60 0%, #2c3e50 100%); /* 신비로운 녹색 */
  color: #fff;
  border: 1px solid #2ecc71;
  box-shadow: 0 8px 30px rgba(46, 204, 113, 0.4);
}
.feature-card.bubble-shooter.game .card-icon {
  color: #2ecc71;
  text-shadow: 0 0 10px #2ecc71;
}
.feature-card.bubble-shooter.game h3 { color: #fff; }
.feature-card.bubble-shooter.game p { color: #ecf0f1; opacity: 0.9; }
.feature-card.bubble-shooter.game .card-enter {
  color: #2ecc71;
  background: rgba(255, 255, 255, 0.1);
  border-color: #2ecc71;
}
.feature-card.bubble-shooter.game:hover {
  border-color: #58d68d;
  box-shadow: 0 12px 35px rgba(46, 204, 113, 0.6);
}
/* ▲▲▲ (추가 완료) ▲▲▲ */
/* ▼▼▼ [★핵심 추가★] "솔트 스텝" 게임 카드 스타일 ▼▼▼ */
.feature-card.step-game.game {
  background: linear-gradient(135deg, #a8c0ff 0%, #3f2b96 100%); /* 천국 계단 느낌 */
  color: #fff;
  border: 1px solid #a8c0ff;
  box-shadow: 0 8px 30px rgba(168, 192, 255, 0.4);
}
.feature-card.step-game.game .card-icon {
  color: #fff;
  text-shadow: 0 0 10px #fff;
}
.feature-card.step-game.game h3 { color: #fff; }
.feature-card.step-game.game p { color: #ecf0f1; opacity: 0.9; }
.feature-card.step-game.game .card-enter {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border-color: #fff;
}
.feature-card.step-game.game:hover {
  border-color: #c9d6ff;
  box-shadow: 0 12px 35px rgba(168, 192, 255, 0.6);
}
/* ▲▲▲ (추가 완료) ▲▲▲ */
/* ▼▼▼ [★핵심 추가★] "워킹 솔트" 카드 스타일 ▼▼▼ */
.feature-card.walking-salt.game {
  background: linear-gradient(135deg, #28a745 0%, #218838 100%); /* 건강한 녹색 */
  color: #fff;
  border: 1px solid #2ecc71;
  box-shadow: 0 8px 30px rgba(40, 167, 69, 0.4);
}
.feature-card.walking-salt.game .card-icon {
  color: #fff;
  text-shadow: 0 0 10px #fff;
}
.feature-card.walking-salt.game h3 { color: #fff; }
.feature-card.walking-salt.game p { color: #ecf0f1; opacity: 0.9; }
.feature-card.walking-salt.game .card-enter {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  border-color: #fff;
}
.feature-card.walking-salt.game:hover {
  border-color: #20c997;
  box-shadow: 0 12px 35px rgba(40, 167, 69, 0.6);
}
/* ▲▲▲ (추가 완료) ▲▲▲ */
/* ▼▼▼ [★핵심 추가★] "솔트 블록 1010" 게임 카드 스타일 ▼▼▼ */
.feature-card.block-puzzle.game {
  background: linear-gradient(135deg, #005C97 0%, #363795 100%); /* 신비로운 파란색 */
  color: #fff;
  border: 1px solid #3498db;
  box-shadow: 0 8px 30px rgba(52, 152, 219, 0.4);
}
.feature-card.block-puzzle.game .card-icon {
  color: #3498db;
  text-shadow: 0 0 10px #3498db;
}
.feature-card.block-puzzle.game h3 { color: #fff; }
.feature-card.block-puzzle.game p { color: #ecf0f1; opacity: 0.9; }
.feature-card.block-puzzle.game .card-enter {
  color: #3498db;
  background: rgba(255, 255, 255, 0.1);
  border-color: #3498db;
}
.feature-card.block-puzzle.game:hover {
  border-color: #5dade2;
  box-shadow: 0 12px 35px rgba(52, 152, 219, 0.6);
}
/* ▲▲▲ (추가 완료) ▲▲▲ */
.feature-card.alchemy.game {
  background: linear-gradient(135deg, #4a0e97 0%, #764ba2 100%); /* 신비로운 보라색 */
  color: #fff;
  border: 1px solid #9b59b6;
  box-shadow: 0 8px 30px rgba(155, 89, 182, 0.4);
}
.feature-card.alchemy.game .card-icon {
  color: #f1c40f; /* 금색 아이콘 */
  text-shadow: 0 0 10px #f1c40f;
}
.feature-card.alchemy.game h3 {
  color: #fff;
}
.feature-card.alchemy.game p {
  color: #ecf0f1;
  opacity: 0.9;
}
.feature-card.alchemy.game .card-enter {
  color: #f1c40f;
  background: rgba(255, 255, 255, 0.1);
  border-color: #f1c40f;
}
.feature-card.alchemy.game:hover {
  border-color: #f39c12;
  box-shadow: 0 12px 35px rgba(155, 89, 182, 0.6);
}
.feature-card.crystal-game {
  background: linear-gradient(145deg, #1e2a3a, #3b506c);
  color: #fff;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 30px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.feature-card.crystal-game:hover {
  box-shadow: 0 15px 40px rgba(45, 74, 109, 0.4);
}
.crystal-icon-main {
  font-size: 4em;
  color: #fff;
  margin-bottom: 20px;
  text-shadow: 0 0 25px rgba(255, 255, 255, 0.7);
  animation: float-icon 5s ease-in-out infinite;
  z-index: 2;
}
@keyframes float-icon {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
.crystal-aura-bg {
  position: absolute;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(137, 247, 254, 0.3) 0%, rgba(102, 166, 255, 0) 70%);
  border-radius: 50%;
  animation: aura-pulse 4s infinite alternate;
  z-index: 0;
}
@keyframes aura-pulse {
  from { transform: scale(0.9); opacity: 0.7; }
  to { transform: scale(1.1); opacity: 1; }
}
.feature-card.crystal-game .card-content {
  z-index: 1;
}
.feature-card.crystal-game h3 {
  font-size: 1.8em;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.feature-card.crystal-game p {
  color: #c9d6e4;
  font-size: 1.05em;
}
.feature-card.crystal-game .card-enter {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
  padding: 8px 18px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}
.feature-card.crystal-game:hover .card-enter {
  background: rgba(255, 255, 255, 0.3);
  color: #fff;
}
.feature-card.pvp .card-icon {
  color: #e74c3c;
}
.feature-card.revenue .card-icon {
  color: #dc3545;
}
.feature-card.tokens .card-icon {
  color: #ffc107;
}

/* [핵심 추가] QR 스캐너 카드 아이콘 색상 스타일 */
.feature-card.qr-scanner .card-icon {
  color: #007bff; /* 파란색 계열 아이콘 */
}
/* [핵심 추가] 잭팟 당첨 전광판 스타일 */
.jackpot-winner-card {
  padding: 20px 25px;
  margin-bottom: 30px;
  text-align: center;
  background: linear-gradient(90deg, #f7971e, #ffd200);
  color: #333;
  font-size: 1.2em;
  font-weight: 500;
  animation: glow 2s infinite alternate;
}
.jackpot-winner-card p {
  margin: 0;
}
@keyframes glow {
  from { box-shadow: 0 0 10px #f7971e; }
  to { box-shadow: 0 0 25px #ffd200; }
}
.subscription-status-card {
  margin-top: 25px;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid hsla(0, 0%, 100%, 0.3);
  background: hsla(0, 0%, 100%, 0.1);
  transition: all 0.3s ease;
}
.subscription-status-card.status-overdue {
  background: hsla(0, 80%, 60%, 0.2);
  border-color: hsla(0, 80%, 70%, 0.5);
}
.status-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.status-header h4 {
  margin: 0;
  font-size: 1.1em;
}
.subscription-status-card p {
  margin: 0 0 15px 0;
  font-size: 1.05em;
}
.warning-text {
  font-size: 0.9em !important;
  opacity: 0.9;
}
.btn-pay {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background-color: #17a2b8;
  color: white;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}
.btn-pay.urgent {
  background-color: #dc3545;
}
.btn-pay:disabled {
  background-color: #5a6268;
  cursor: not-allowed;
}
.spinner-small {
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #fff;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.feature-card.game .card-icon {
  color: #e74c3c;
}
.clickable {
  cursor: pointer;
  text-decoration: underline;
}
.clickable:hover {
  color: #aed6f1;
}
.dashboard-container {
  padding: 20px;
  max-width: 1200px;
  margin: 10px auto 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.notice-section {
  padding: 20px 25px;
  margin-bottom: 30px;
}
.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.notice-header h3 {
  margin: 0;
  font-size: 1.4em;
  display: flex;
  align-items: center;
  gap: 10px;
}
.more-link {
  font-size: 0.9em;
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}
.notice-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.notice-link {
  display: flex;
  justify-content: space-between;
  padding: 10px 5px;
  text-decoration: none;
  color: #333;
  border-radius: 5px;
  transition: background-color 0.2s ease;
}
.notice-link:hover {
  background-color: #f8f9fa;
}
.notice-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}
.notice-date {
  color: #888;
  flex-shrink: 0;
}
.card {
  background: #fff;
  border-radius: 15px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
}
.performance-card {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: #fff;
  padding: 25px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid hsla(0, 0%, 100%, 0.3);
  padding-bottom: 15px;
  margin-bottom: 20px;
}
.card-header h3 {
  font-size: 1.5em;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}
.tier-badge {
  font-size: 1em;
  font-weight: 700;
  padding: 8px 18px;
  border-radius: 20px;
  text-transform: uppercase;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    0 2px 5px rgba(0, 0, 0, 0.2),
    inset 0 1px 1px rgba(255, 255, 255, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}
.tier-badge:hover {
  transform: scale(1.05);
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.3),
    inset 0 1px 1px rgba(255, 255, 255, 0.3);
}
.tier-badge.pending {
  background: linear-gradient(135deg, #ffc107, #ff9800);
  color: #333;
}
.tier-badge.bronze {
  background: linear-gradient(135deg, #cd7f32, #a0522d);
}
.tier-badge.premium {
  background: linear-gradient(135deg, #c0c0c0, #a9a9a9);
}
.tier-badge.vip {
  background: linear-gradient(135deg, #ffd700, #f0c000);
}
.tier-badge.vvip {
  background: linear-gradient(135deg, #e5e5e5, #b8b8b8);
  text-shadow: 0 0 5px #fff;
}
.tier-badge.infinite {
  background: linear-gradient(135deg, #4d4d4d, #1a1a1a);
  text-shadow: 0 0 8px #fff;
}
.investment-info {
  text-align: center;
  margin-bottom: 20px;
  padding: 10px;
  background: hsla(0, 0%, 100%, 0.1);
  border-radius: 8px;
}
.investment-info span {
  opacity: 0.9;
  margin-right: 10px;
  font-size: 1.1em;
}
.investment-info strong {
  font-size: 1.3em;
  font-weight: 700;
}
.performance-body h4 {
  font-size: 1.1em;
  margin-bottom: 10px;
  font-weight: 500;
}
.progress-bar-container {
  width: 100%;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 20px;
  height: 24px;
  overflow: hidden;
  position: relative;
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #17a2b8, #28a745);
  border-radius: 20px;
  transition: width 0.8s cubic-bezier(0.25, 1, 0.5, 1);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.running-man {
  color: white;
  font-size: 1.2em;
  margin-right: 10px;
  animation: running-animation 0.7s infinite alternate;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
@keyframes running-animation {
  from {
    transform: translateY(0px);
  }
  to {
    transform: translateY(-3px);
  }
}
.progress-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 0.9em;
  opacity: 0.9;
}
.balances {
  margin-top: 25px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  text-align: center;
}
.balance-item {
  background: rgba(0, 0, 0, 0.15);
  padding: 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: background-color 0.3s;
}
.balance-item:hover {
  background: rgba(0, 0, 0, 0.25);
}
.balance-item.cash label {
  display: block;
  font-size: 1em;
  margin-bottom: 8px;
  opacity: 0.8;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.balance-item.cash span {
  font-size: 2em;
  font-weight: 700;
  line-height: 1;
}
.balance-item.cash small {
  font-size: 1em;
  margin-left: 5px;
}
.balance-item.saltmate {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.4);
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30px 20px;
  transition: all 0.3s ease;
}
.balance-item.saltmate:hover {
  transform: translateY(-5px) scale(1.05);
  box-shadow: 0 15px 30px rgba(118, 75, 162, 0.5);
}
.balance-content {
  text-align: center;
  z-index: 1;
}
.balance-label {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  font-size: 1.1em;
  font-weight: 500;
  opacity: 0.9;
  margin-bottom: 15px;
}
.balance-value {
  font-size: 2.8em;
  font-weight: 700;
  line-height: 1.1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.balance-unit {
  font-size: 1.2em;
  font-weight: 500;
  opacity: 0.9;
  letter-spacing: 1px;
  margin-top: 5px;
}
.shimmer-effect {
  position: absolute;
  top: 0;
  left: -150%;
  width: 75%;
  height: 100%;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  transform: skewX(-25deg);
  animation: shimmer 5s infinite;
}
@keyframes shimmer {
  100% {
    left: 150%;
  }
}
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 30px;
  margin-top: 30px;
}
.feature-card {
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  padding: 30px;
  border-radius: 15px;
  background-color: #fff;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  position: relative;
  min-height: 220px;
}
.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
}
.card-icon {
  font-size: 2.5em;
  margin-bottom: 15px;
}
.feature-card h3 {
  font-size: 1.6em;
  margin: 0 0 10px;
}
.feature-card p {
  font-size: 1em;
  color: #666;
  line-height: 1.5;
  flex-grow: 1;
}
.card-enter {
  font-weight: 700;
  color: #007bff;
  align-self: flex-end;
  transition: color 0.3s ease;
}
.feature-card:hover .card-enter {
  color: #0056b3;
}
.feature-card.equity .card-icon {
  color: #fd7e14;
}
.feature-card.events .card-icon {
  color: #28a745;
}
.feature-card.mall .card-icon {
  color: #6f42c1;
}
.feature-card.nft .card-icon {
  color: #17a2b8;
}
.feature-card.revenue .card-icon {
  color: #dc3545;
}
.feature-card.tokens .card-icon {
  color: #ffc107;
}
.token-glance {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
}
.token-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 1.1em;
}
.token-item img {
  height: 24px;
}
.upgrade-action {
  margin-top: 20px;
  text-align: center;
}
.upgrade-button {
  background-color: #ffc107;
  color: #212529;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
}
.upgrade-button:disabled {
  background-color: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
}
.upgrade-button:hover:not(:disabled) {
  background-color: #e0a800;
  transform: translateY(-2px);
}
.withdrawal-action {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid hsla(0, 0%, 100%, 0.2);
}
.withdrawal-button {
  width: 100%;
  background-color: #28a745;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
}
.withdrawal-button:disabled {
  background-color: #5a6268;
  cursor: not-allowed;
  opacity: 0.7;
}
.withdrawal-notice {
  display: block;
  margin-top: 8px;
  font-size: 0.8em;
  opacity: 0.9;
  text-align: center;
}
.feature-card.treasure .card-icon {
  color: #e67e22;
}
.feature-card.salt-game .card-icon {
  color: #3498db;
}
.feature-card.salt-mine-game .card-icon {
  color: #ffd166;
}
.feature-card.deep-sea-game .card-icon {
  color: #17a2b8;
}
@media (max-width: 768px) {
  .balances {
    grid-template-columns: 1fr; /* 화면이 좁아지면 1개의 열(세로 배치)로 변경 */
  }
}
.dashboard-container {
padding: 20px; /* 기존 padding-top: 0; gap: 0; 스타일은 인라인으로 추가했으므로 여기는 유지 */
}
/* ▼▼▼ [핵심 수정] 솔레인 제작 공방 카드 스타일 추가 ▼▼▼ */
.crafting-workshop-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(45deg, #2c3e50, #34495e); /* 기본 배경 유지 */
  border-color: #f1c40f; /* 테두리 강조 */
  box-shadow: 0 0 15px rgba(241, 196, 15, 0.5); /* 은은한 황금빛 발광 */
  animation: glowing-border 2s infinite alternate; /* 테두리 반짝임 */
}

.crafting-workshop-card .card-icon {
  color: #f1c40f; /* 아이콘 색상 황금색 */
  text-shadow: 0 0 8px rgba(241, 196, 15, 0.8); /* 아이콘 발광 */
}

.crafting-workshop-card h3,
.crafting-workshop-card p,
.crafting-workshop-card .card-enter {
  color: #fdfde0; /* 텍스트 색상 밝은 황금색 계열 */
  text-shadow: 0 0 5px rgba(241, 196, 15, 0.4);
}

/* 마우스 오버 시 카드 전체에 황금빛 이펙트 */
.crafting-workshop-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    transparent,
    rgba(241, 196, 15, 0.4), /* 황금색 강조 */
    transparent 30%,
    transparent 70%,
    rgba(241, 196, 15, 0.4),
    transparent
  );
  transform: rotate(0deg);
  animation: rotate-shine 4s linear infinite; /* 회전하는 빛 효과 */
  opacity: 0;
  transition: opacity 0.5s ease;
  z-index: 0; /* 배경에 배치 */
}

.crafting-workshop-card:hover::before {
  opacity: 1; /* 호버 시 빛 효과 활성화 */
}

/* 카드 내부 요소들이 빛 위에 오도록 */
.crafting-workshop-card > * {
  position: relative;
  z-index: 1;
}
.rank-card {
  background: rgba(44, 62, 80, 0.7);
  border-radius: 15px;
  padding: 20px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
  display: flex;
  flex-direction: column;
  color: #ecf0f1;
  text-align: center;
  position: relative;
  overflow: hidden; /* 자식 요소 스크롤을 위해 overflow-y를 덮어쓰기 위해 설정 */
}

.rank-card.click-rank-card {
  /* ▼▼▼ [핵심 수정] 이 부분을 추가하거나 변경해 주세요 ▼▼▼ */
  max-height: 300px; /* 원하는 높이로 조절 (예: 300px) */
  overflow-y: auto; /* 내용이 넘치면 스크롤바 생성 */
  /* ▲▲▲ */
}
/* 애니메이션 키프레임 */
@keyframes glowing-border {
  0% {
    border-color: #f1c40f;
    box-shadow: 0 0 15px rgba(241, 196, 15, 0.5);
  }
  50% {
    border-color: #ffd700; /* 금색 */
    box-shadow: 0 0 25px rgba(255, 215, 0, 0.8), 0 0 35px rgba(255, 215, 0, 0.6);
  }
  100% {
    border-color: #f1c40f;
    box-shadow: 0 0 15px rgba(241, 196, 15, 0.5);
  }
}

@keyframes rotate-shine {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
/* ▼▼▼ 메타버스 포털 카드 스타일 ▼▼▼ */
.feature-card.metaverse-portal-card {
  background: linear-gradient(135deg, #2c3e50 0%, #4a0e97 100%); /* 딥블루 -> 퍼플 그라데이션 */
  color: #fff; /* 기본 텍스트 색상 흰색 */
  border: 1px solid rgba(142, 68, 173, 0.5); /* 퍼플 계열 테두리 */
  box-shadow: 0 8px 30px rgba(74, 14, 151, 0.3); /* 퍼플 계열 그림자 */
  position: relative; /* 내부 효과를 위한 설정 */
  overflow: hidden; /* 내부 효과를 위한 설정 */
  /* [수정] min-height: 200px; 라인을 삭제하여 .feature-card의 220px를 따르도록 함 */
}

/* 카드 아이콘 스타일 */
.feature-card.metaverse-portal-card .card-icon {
  color: #9b59b6; /* 아이콘 색상 (연한 퍼플) */
  text-shadow: 0 0 15px rgba(155, 89, 182, 0.7); /* 아이콘 글로우 효과 */
}

/* 카드 제목 스타일 (흰색 유지) */
.feature-card.metaverse-portal-card h3 {
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* 카드 설명 텍스트 스타일 */
.feature-card.metaverse-portal-card p {
  color: #ecf0f1; /* 약간 밝은 회색 */
  opacity: 0.9;
}

/* '미리보기 ->' 텍스트 스타일 */
.feature-card.metaverse-portal-card .card-enter {
  color: #e9d4ff; /* 연한 라벤더 색상 */
  background: rgba(255, 255, 255, 0.1);
  padding: 6px 12px;
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

/* 호버 시 '미리보기 ->' 텍스트 스타일 */
.feature-card.metaverse-portal-card:hover .card-enter {
  color: #fff;
  background: rgba(155, 89, 182, 0.5); /* 호버 시 배경색 (퍼플) */
  border-color: rgba(255, 255, 255, 0.4);
}

/* (선택) 미묘한 배경 패턴 또는 효과 추가 */
.feature-card.metaverse-portal-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: radial-gradient(circle at top left, rgba(142, 68, 173, 0.2) 0%, transparent 40%),
                    radial-gradient(circle at bottom right, rgba(88, 24, 69, 0.2) 0%, transparent 50%);
  opacity: 0.7;
  transition: opacity 0.4s ease;
  pointer-events: none; /* 클릭 방해하지 않도록 */
  z-index: 0;
}

.feature-card.metaverse-portal-card:hover::before {
  opacity: 1; /* 호버 시 패턴 강조 */
}

/* 카드 내부 요소들이 패턴 위에 오도록 */
.feature-card.metaverse-portal-card > * {
  position: relative;
  z-index: 1;
}

/* ▲▲▲ 메타버스 포털 카드 스타일 끝 ▲▲▲ */
/* 기존 DashboardPage 스타일 */
.dashboard-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

/* 솔레인 디지털 유토피아 카드 스타일 (기존 코드에서 가져오기 또는 새로 추가) */
.solain-utopia-card {
  /* 첨부해주신 이미지의 카드 스타일을 여기에 적용합니다 */
  background: linear-gradient(135deg, #4b0082, #8a2be2); /* 보라색 계열 그라데이션 */
  color: #fff;
  border-radius: 15px;
  padding: 1.5rem 2rem;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 200px;
}
.solain-utopia-card .card-icon { font-size: 3.5rem; margin-bottom: 1rem; align-self: flex-start; opacity: 0.8; }
.solain-utopia-card .card-title { font-size: 1.8rem; font-weight: bold; margin-bottom: 0.5rem; line-height: 1.3; }
.solain-utopia-card .card-description { font-size: 1rem; line-height: 1.5; opacity: 0.9; }
.solain-utopia-card .card-action { margin-top: 1.5rem; align-self: flex-end; }
.solain-utopia-card .btn-primary {
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #fff;
  padding: 0.8rem 1.5rem;
  border-radius: 50px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease, border-color 0.3s ease;
  display: flex;
  align-items: center;
}
.solain-utopia-card .btn-primary:hover {
  background-color: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.6);
}
.solain-utopia-card .btn-primary i { margin-left: 0.8rem; font-size: 0.9rem; }
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 30px;
  margin-top: 30px;
}

/* ▼▼▼ [신규 추가] ▼▼▼ */
.dashboard-grid .avatar-showcase {
  /* 1열부터 마지막 열까지(-1) 모두 차지 (즉, 3칸) */
  grid-column: 1 / -1; 
  /* 최소 높이 설정 (선택 사항) */
  min-height: 250px; 
}
/* ▼▼▼ [★신규 추가★] 전설의 황금 상자 카드 전용 스타일 ▼▼▼ */

/* 카드 기본 레이아웃 */
.treasure-card-enhanced {
  position: relative;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* 내부 콘텐츠 가로 정렬 (모바일은 세로) */
.treasure-card-enhanced .card-content-wrapper {
  display: flex;
  align-items: center;
  text-align: left;
  gap: 20px;
  height: 100%;
  width: 100%;
}

/* 피버 타임일 때 배경색 강조 */
.treasure-card-enhanced.is-fever {
  background: linear-gradient(145deg, rgba(255, 78, 80, 0.15), rgba(249, 212, 35, 0.15));
  border-color: rgba(255, 215, 0, 0.5);
  box-shadow: 0 0 20px rgba(255, 78, 80, 0.2);
}

/* 피버 배지 스타일 */
.fever-badge-mini {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(90deg, #ff4e50, #f9d423);
  color: #fff;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 0.75rem;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(255, 78, 80, 0.4);
  animation: pulse-fever-mini 1.5s infinite;
  z-index: 2;
}

/* 상자 아이콘 컨테이너 */
.chest-icon-container {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  animation: breathe-mini 3s infinite ease-in-out; /* 숨쉬는 효과 */
}

.chest-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5));
  position: relative;
  z-index: 1;
}

/* 아이콘 뒤 후광 효과 */
.glow-effect-mini {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120%;
  height: 120%;
  background: radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  border-radius: 50%;
  z-index: 0;
  opacity: 0.6;
  transition: background 0.3s ease;
}

.is-fever .glow-effect-mini {
  background: radial-gradient(circle, rgba(255, 78, 80, 0.5) 0%, transparent 70%);
  opacity: 0.8;
}

/* 텍스트 스타일 */
.treasure-card-enhanced .card-text h3 {
  margin: 0 0 8px 0;
  font-size: 1.3rem;
  color: #FFED00F; /* <-- 이 부분을 수정하세요 #FFD700 2025-11-23*/
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.treasure-card-enhanced .card-text p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  color: #000000; /* <-- 이 부분을 수정하세요 #e0e0e0 */
}

/* 피버 타임 안내 텍스트 */
.fever-alert {
  color: #FFFF00 !important; /* <-- 이 부분을 수정하세요 #FFD700 */
  font-weight: bold;
  font-size: 0.85rem !important;
  margin-top: 8px !important;
  text-shadow: 0 0 8px rgba(255, 78, 80, 0.6);
  animation: pulse-text 1.5s infinite;
}

/* 애니메이션 키프레임 */
@keyframes breathe-mini {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

@keyframes pulse-fever-mini {
  0% { transform: scale(1); box-shadow: 0 2px 8px rgba(255, 78, 80, 0.4); }
  50% { transform: scale(1.1); box-shadow: 0 4px 15px rgba(255, 78, 80, 0.7); }
  100% { transform: scale(1); box-shadow: 0 2px 8px rgba(255, 78, 80, 0.4); }
}

@keyframes pulse-text {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* 모바일 반응형 (화면이 좁을 때 세로 배치) */
@media (max-width: 600px) {
  .treasure-card-enhanced .card-content-wrapper {
    flex-direction: column;
    text-align: center;
    justify-content: center;
    gap: 15px;
  }
  .fever-badge-mini {
    top: 10px;
    right: 10px;
  }
}
</style>