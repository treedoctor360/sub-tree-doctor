import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: https://treedoctor360.github.io/sub-tree-doctor/
export default defineConfig({
  base: '/sub-tree-doctor/',
  plugins: [react()],
});
