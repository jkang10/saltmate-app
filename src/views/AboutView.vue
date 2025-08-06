<template>
  <div class="about-page-container">
    <swiper
      :modules="[Navigation, Pagination, Autoplay, EffectFade]"
      :slides-per-view="1"
      :space-between="30"
      :loop="true"
      :autoplay="{
        delay: 5000,
        disableOnInteraction: false,
      }"
      :pagination="{ clickable: true }"
      :navigation="true"
      :effect="'fade'"
      class="intro-swiper"
    >
      <swiper-slide class="slide-item">
        <div class="slide-content intro">
          <h1 class="title">SALT MATE</h1>
          <p class="subtitle">�̷��� ���� ���ο� ��ġ, ��Ʈ����Ʈ�� �Բ�</p>
        </div>
      </swiper-slide>

      <swiper-slide class="slide-item">
        <div class="slide-content vision">
          <h2 class="slide-title">�츮�� ����</h2>
          <p class="slide-text">
            ��Ʈ����Ʈ�� �ܼ��� ���ڸ� �Ѿ�, ���� ������ �̷� ��ġ�� â���ϴ� ��������
            ���°踦 �����մϴ�.
          </p>
        </div>
      </swiper-slide>

      <swiper-slide class="slide-item">
        <div class="slide-content core-values">
          <h2 class="slide-title">�ٽ� ��ġ</h2>
          <div class="values-grid">
            <div class="value-item">
              <i class="fas fa-handshake"></i>
              <h3>�ŷ�</h3>
              <p>������ ���� ������ �������� �ý��� �</p>
            </div>
            <div class="value-item">
              <i class="fas fa-lightbulb"></i>
              <h3>����</h3>
              <p>����ü�� ����� ���� ���ο� ���� �з����� ����</p>
            </div>
            <div class="value-item">
              <i class="fas fa-users"></i>
              <h3>���</h3>
              <p>������ ��ΰ� �Բ� �����ϴ� ����ȯ ����</p>
            </div>
          </div>
        </div>
      </swiper-slide>

      <swiper-slide class="slide-item">
        <div class="slide-content profit-model">
          <h2 class="slide-title">���� ��</h2>
          <p class="slide-text">
            �������� ���� ���Ͱ� ��õ Ȱ���� ���� �߰� ����, �׸��� ���°� �⿩�� ����
            ��ū ���ڳ�̱���. �ٰ�ȭ�� ���� ���� ���� �������� ������ �ش�ȭ�մϴ�.
          </p>
        </div>
      </swiper-slide>

      <swiper-slide class="slide-item">
        <div class="slide-content outro">
          <h2 class="slide-title">
            ����, ��Ʈ����Ʈ�� �Բ�<br />�������� ���ڸ� �����ϼ���.
          </h2>
          <router-link to="/dashboard" class="start-button">
            ��ú���� �̵� <i class="fas fa-arrow-right"></i>
          </router-link>
        </div>
      </swiper-slide>
    </swiper>
  </div>
</template>

<script>
// Swiper Vue.js ������Ʈ ����Ʈ
import { Swiper, SwiperSlide } from "swiper/vue";
import { Navigation, Pagination, Autoplay, EffectFade } from "swiper/modules";

// Swiper ��Ÿ�� ����Ʈ
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-fade";

export default {
  name: "AboutPage",
  components: {
    Swiper,
    SwiperSlide,
  },
  setup() {
    return {
      modules: [Navigation, Pagination, Autoplay, EffectFade],
    };
  },
};
</script>

<style scoped>
.about-page-container {
  width: 100%;
  height: 100vh; /* ȭ�� ��ü ���� */
  overflow: hidden;
}

.intro-swiper {
  width: 100%;
  height: 100%;
}

.slide-item {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: white;
}

/* ��� �̹��� �� �������� */
.slide-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  filter: brightness(0.6); /* ��� ��Ӱ� */
  z-index: -1;
}

/* �����̵庰 ��� �̹��� ���� */
.slide-item:nth-child(1)::before {
  background-image: url("https://images.unsplash.com/photo-1554224155-1696413565d3?q=80&w=2940&auto=format&fit=crop");
}
.slide-item:nth-child(2)::before {
  background-image: url("https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=2940&auto=format&fit=crop");
}
.slide-item:nth-child(3)::before {
  background-image: url("https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=3048&auto=format&fit=crop");
}
.slide-item:nth-child(4)::before {
  background-image: url("https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?q=80&w=2940&auto=format&fit=crop");
}
.slide-item:nth-child(5)::before {
  background-image: url("https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=2940&auto=format&fit=crop");
}

.slide-content {
  max-width: 800px;
  padding: 40px;
  background-color: rgba(0, 0, 0, 0.4);
  border-radius: 15px;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.title {
  font-size: 5em;
  font-weight: 900;
  margin-bottom: 10px;
  text-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}
.subtitle {
  font-size: 1.5em;
  opacity: 0.9;
}
.slide-title {
  font-size: 3em;
  margin-bottom: 20px;
}
.slide-text {
  font-size: 1.2em;
  line-height: 1.8;
}

/* �ٽ� ��ġ ���� */
.values-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
  margin-top: 40px;
}
.value-item {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 25px;
  border-radius: 10px;
}
.value-item i {
  font-size: 2.5em;
  color: #007bff;
  margin-bottom: 15px;
}
.value-item h3 {
  font-size: 1.5em;
  margin-bottom: 10px;
}

/* ���� ��ư */
.start-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 30px;
  padding: 15px 30px;
  background-color: #007bff;
  color: white;
  text-decoration: none;
  font-weight: bold;
  font-size: 1.2em;
  border-radius: 50px;
  transition: all 0.3s ease;
}
.start-button:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 123, 255, 0.4);
}

/* Swiper �׺���̼�/���������̼� ��Ÿ�� Ŀ���͸���¡ */
:deep(.swiper-button-next),
:deep(.swiper-button-prev) {
  color: white;
  background-color: rgba(0, 0, 0, 0.3);
  width: 50px;
  height: 50px;
  border-radius: 50%;
}
:deep(.swiper-pagination-bullet-active) {
  background-color: white;
}
</style>
