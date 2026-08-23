import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs let the same build work everywhere: GitHub project
  // pages (/<repo>/), the user page, and a custom domain served at "/".
  base: './',
});
