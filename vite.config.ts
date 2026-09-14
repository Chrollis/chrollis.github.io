import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

import { en } from './src/data/locales/en'
import { site } from './src/data/site'

/**
 * User site, served from https://chrollis.github.io, so `base` is `/`. To move to a project
 * repository, change only `BASE`; everything else resolves through imports or
 * `import.meta.env.BASE_URL`.
 */
const BASE = '/'

/**
 * Fills the `%SITE_*%` placeholders in `index.html` from the same modules the app renders
 * from, in dev and build alike, so the static head cannot drift from the locale files.
 * `%BASE_URL%` is left alone - Vite replaces that one itself.
 */
function htmlCopy(): Plugin {
  const values: Record<string, string> = {
    SITE_NAME: site.name,
    SITE_DESCRIPTION: en.meta.site,
    SITE_URL: site.url,
    SITE_GITHUB: `https://github.com/${site.github}`,
  }

  return {
    name: 'html-copy',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => html.replace(/%([A-Z_]+)%/g, (match, key: string) => values[key] ?? match),
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [react(), htmlCopy()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    cssTarget: 'chrome100',
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    rollupOptions: {
      output: {
        /* Manual chunking: three is the largest dependency and is only reached through a
           lazy import, so it stays out of the initial payload. Markdown loads on a post
           page and search only when opened. */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](three|@react-three)[\\/]/.test(id)) return 'three'
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) {
            return 'motion'
          }
          if (
            /[\\/]node_modules[\\/](react-markdown|remark-|rehype-|micromark|mdast-|unist-|hast-|highlight\.js|unified|vfile|property-information|ccount|escape-string-regexp|markdown-table|longest-streak|zwitch|bail|trough|devlop|comma-separated-tokens|space-separated-tokens|web-namespaces|html-url-attributes|trim-lines|decode-named-character-reference|character-entities|lowlight|fault)/.test(
              id,
            )
          ) {
            return 'markdown'
          }
          if (/[\\/]node_modules[\\/]flexsearch[\\/]/.test(id)) return 'search'
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
            return 'vendor'
          }
          return undefined
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
})
