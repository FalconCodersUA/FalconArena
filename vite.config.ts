import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react-swc';
import path from "path"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
    server: {
        host: '0.0.0.0',
        fs: {
            strict: false,
        },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {sourcemap: false},
});
