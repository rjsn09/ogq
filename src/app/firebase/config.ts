// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);
