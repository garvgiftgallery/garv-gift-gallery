import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/logo.png', 'assets/logo-192.png', 'assets/logo-512.png'],
      manifest: {
        short_name: "Garv Gift Gallery",
        name: "Garv Gift Gallery B2B Portal",
        description: "Exclusive B2B portal for premium gifts and bulk corporate gifting.",
        theme_color: "#111111",
        background_color: "#F9F8F6",
        display: "standalone",
        icons: [
          {
            src: '/assets/logo-192.png', 
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/assets/logo-512.png', 
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress the PWA plugin bundle variable warning
        if (warning.code === 'THIS_IS_UNDEFINED' || warning.message.includes('plugin assigns to bundle variable')) {
          return;
        }
        warn(warning);
      },
      // ✨ ADDED: Code-Splitting logic to break up the 2.3MB chunk
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Isolate the massive HEIC decoder into its own file
            if (id.includes('heic2any')) {
              return 'heic2any-vendor';
            }
            // Group all Firebase libraries together
            if (id.includes('firebase')) {
              return 'firebase-vendor';
            }
            // Group React core libraries together
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            // Dump everything else (PapaParse, localforage, etc.) into a general dependencies chunk
            return 'general-vendor';
          }
        }
      }
    }
  }
});