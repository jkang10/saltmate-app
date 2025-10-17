<template>
  <div class="weather-page-container">
    <div id="weather-app">
      <h1><i class="fas fa-cloud-sun"></i> 상세 날씨 정보</h1>
      <div class="search-container">
        <input
          type="text"
          id="city-input"
          placeholder="도시 이름을 입력하세요 (예: Seoul)"
          v-model="city"
          @keyup.enter="getWeather"
        />
        <button id="search-btn" @click="getWeather">검색</button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>날씨를 불러오는 중입니다...</p>
      </div>
      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
      </div>
      <div v-else-if="weather" id="weather-info">
        <h2 id="city-name">{{ weather.name }}</h2>
        <img id="weather-icon" :src="iconUrl" alt="날씨 아이콘" />
        <p id="temperature">{{ weather.temperature }}°C</p>
        <p id="description">{{ weather.description }}</p>
      </div>
      <div v-else class="initial-state">
          <p>도시를 검색하여 날씨를 확인하세요.</p>
      </div>
    </div>
    <router-link to="/dashboard" class="back-button">
      <i class="fas fa-arrow-left"></i> 대시보드로 돌아가기
    </router-link>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

// ❗️여기에 OpenWeatherMap에서 발급받은 API 키를 입력하세요.
const apiKey = "b6c39250c7938bd189a96e2b4d4fa9cf";

const city = ref('Seoul'); // 기본값으로 'Seoul' 설정
const weather = ref(null);
const isLoading = ref(false);
const error = ref(null);

const iconUrl = computed(() => {
    if (weather.value) {
        return `https://openweathermap.org/img/wn/${weather.value.icon}@2x.png`;
    }
    return '';
});

const getWeather = async () => {
    if (!city.value) {
        alert("도시 이름을 입력해주세요.");
        return;
    }
    isLoading.value = true;
    error.value = null;
    weather.value = null;
    const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city.value}&appid=${apiKey}&units=metric&lang=kr`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("도시를 찾을 수 없습니다.");
        const data = await response.json();
        weather.value = {
            name: data.name,
            temperature: Math.round(data.main.temp),
            description: data.weather[0].description,
            icon: data.weather[0].icon,
        };
    } catch (e) {
        error.value = e.message;
    } finally {
        isLoading.value = false;
    }
};

// 페이지가 로드될 때 기본값(Seoul)으로 날씨를 한번 불러옵니다.
onMounted(getWeather);
</script>

<style scoped>
.weather-page-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 80px;
}
#weather-app {
    font-family: sans-serif;
    background: white;
    padding: 30px;
    border-radius: 15px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    width: 90%;
    max-width: 400px;
    text-align: center;
}
h1 { color: #333; margin-bottom: 20px; }
.search-container { display: flex; gap: 10px; margin-bottom: 25px; }
#city-input { flex-grow: 1; padding: 12px; font-size: 16px; border: 1px solid #ccc; border-radius: 8px; outline: none; }
#search-btn { padding: 0 20px; font-size: 16px; font-weight: bold; color: white; background-color: #007bff; border: none; border-radius: 8px; cursor: pointer; }
#weather-info { margin-top: 20px; }
#city-name { font-size: 2em; margin: 15px 0; }
#weather-icon { width: 100px; height: 100px; }
#temperature { font-size: 2.5em; font-weight: bold; margin: 10px 0; color: #2c3e50; }
#description { font-size: 1.2em; color: #555; text-transform: capitalize; }
.loading-state, .error-state, .initial-state { padding: 40px 0; color: #666; }
.spinner { display: inline-block; border: 4px solid rgba(0,0,0,0.1); border-top-color: #007bff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 10px; }
@keyframes spin { to { transform: rotate(360deg); } }
.error-state p { color: #e74c3c; font-weight: 500; }
.back-button { margin-top: 20px; text-decoration: none; color: #007bff; font-weight: bold; }
</style>