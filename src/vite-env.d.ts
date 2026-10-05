/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_DOMAIN: string;
  readonly VITE_FIREBASE_DATABASE_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_STORAGE_BUCKET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
