import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        cv: resolve(__dirname, 'cv.html'),
        works: resolve(__dirname, 'works.html'),
        contact: resolve(__dirname, 'contact.html'),
        extra: resolve(__dirname, 'extra.html'),
      }
    }
  }
})
