import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [vue(), tailwindcss()], server: { proxy: { '/socket.io': { target: 'http://127.0.0.1:3001', ws: true }, '/health': 'http://127.0.0.1:3001' } } });
