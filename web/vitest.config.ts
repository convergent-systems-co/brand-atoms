import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'happy-dom',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/__tests__/**/*.test.ts',
      'src/__tests__/**/*.test.tsx',
    ],
    globals: false,
  },
});
