import { defineConfig } from 'vite'

// `base: './'` makes the build work at any GitHub Pages path
// (username.github.io/<repo>/) without knowing the repo name.
export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { target: 'es2020', cssMinify: true },
})
