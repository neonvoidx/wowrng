import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub project pages serve the site under /<repo-name>/; derive it in CI.
  base: process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/',
});
