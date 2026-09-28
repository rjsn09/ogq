/// <reference path="../../vite-env.d.ts" />

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const api_Key = import.meta.env.VITE_FIREBASE_API_KEY;
const firebase_domain = import.meta.env.VITE_FIREBASE_DOMAIN;

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: api_Key,
  authDomain: firebase_domain,
  projectId: "emojigenerator-f3391",
  storageBucket: "emojigenerator-f3391.firebasestorage.app",
  messagingSenderId: "12218394188",
  appId: "1:12218394188:web:8b06c590f3a812988e36e9",
  measurementId: "G-FHQQJ0V60N"
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
