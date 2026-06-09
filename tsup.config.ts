import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  platform: 'neutral',
  target: 'es2020',
  esbuildOptions(options) {
    options.keepNames = true;
  },
});
