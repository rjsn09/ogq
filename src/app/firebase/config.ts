// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // 👈 1. Firestore SDK import 추가

const api_Key = process.env.FIREBASE_API_KEY;
const firebase_domain = process.env.FIREBASE_DOMAIN

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: api_Key,
  authDomain: firebase_domain,
  projectId: "vvos-f58b3",
  storageBucket: "vvos-f58b3.firebasestorage.app",
  messagingSenderId: "799310100616",
  appId: "1:799310100616:web:45ae4c1e4be0aa94f2073d",
  measurementId: "G-8FJ6SB7E5X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // 👈 2. Firestore 인스턴스 export 추가

// 브라우저 환경에서만 Analytics 초기화 (Vercel 서버 빌드 에러 방지)
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}
