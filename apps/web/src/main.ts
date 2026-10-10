import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useGameStore } from './stores/game';
import './style.css';

const app = createApp(App).use(createPinia());
useGameStore().connect();
app.mount('#app');
