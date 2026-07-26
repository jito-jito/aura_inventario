import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@ionic/core/components': '@ionic/core/components/index.js',
    },
  },
});
