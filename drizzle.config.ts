import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/drizzle',
  dialect: 'sqlite',
  driver: 'expo',
});
