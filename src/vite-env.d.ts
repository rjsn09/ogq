/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_DOMAIN: string;
  readonly VITE_FIREBASE_DATABASE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
