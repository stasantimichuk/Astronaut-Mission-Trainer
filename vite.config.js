import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ОБОВ'ЯЗКОВО: точна назва вашого репозиторію в слешах!
  base: '/Astronaut-Mission-Trainer/', 
})