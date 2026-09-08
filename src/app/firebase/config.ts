// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9D83qw_1ZS9zQZlGCuRbWYeLmm9F6kN0",
  authDomain: "vvos-f58b3.firebaseapp.com",
  projectId: "vvos-f58b3",
  storageBucket: "vvos-f58b3.firebasestorage.app",
  messagingSenderId: "799310100616",
  appId: "1:799310100616:web:45ae4c1e4be0aa94f2073d",
  measurementId: "G-8FJ6SB7E5X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); // 👈 이 부분이 반드시 있어야 합니다!

// 브라우저 환경에서만 Analytics 초기화 (Vercel 서버 빌드 에러 방지)
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}
