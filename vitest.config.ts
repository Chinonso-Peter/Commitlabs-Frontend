import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Add this server block to resolve the @stellar/stellar-sdk issue
    server: {
      deps: {
        inline: ['@stellar/stellar-sdk'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'src/**/*.module.css',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})