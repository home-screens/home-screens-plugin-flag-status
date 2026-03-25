import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
  build: {
    lib: {
      entry: 'src/index.tsx',
      formats: ['iife'],
      name: '__HS_PLUGIN__',
      fileName: () => 'bundle.js',
    },
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
