/// <reference path="../../vite-env.d.ts" />

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const api_key = import.meta.env.VITE_FIREBASE_API_KEY;
const firebase_domain = import.meta.env.VITE_FIREBASE_DOMAIN;

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: api_key,
  authDomain: firebase_domain,
  projectId: "emojigenerator-c888e",
  storageBucket: "emojigenerator-c888e.firebasestorage.app",
  messagingSenderId: "918545241315",
  appId: "1:918545241315:web:e90b10d5173ce49b89a1d6",
  measurementId: "G-B13SGX5BCX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// This project's database is named "default" (distinct from Firebase's "(default)").
const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID?.trim() || "default";
export const db = getFirestore(app, firestoreDatabaseId);

// 브라우저 환경에서만 Analytics 초기화 (Vercel 서버 빌드 에러 방지)
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}
