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
      // ✨ THE FIX: Force the PWA plugin to generate the manifest during local dev
      devOptions: {
        enabled: true
      }
    })
  ],
});