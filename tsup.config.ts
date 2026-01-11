import { defineConfig } from 'tsup'

export default defineConfig([
  // Core bundle (no Vue dependency)
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['vue'],
  },
  // Vue composable bundle
  {
    entry: {
      'vue/index': 'src/vue/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    external: ['vue'],
  },
])
