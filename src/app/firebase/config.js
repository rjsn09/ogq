"use strict";
/// <reference path="../../vite-env.d.ts" />
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.analytics = exports.db = exports.auth = void 0;
// Import the functions you need from the SDKs you need
var app_1 = require("firebase/app");
var auth_1 = require("firebase/auth");
var analytics_1 = require("firebase/analytics");
var firestore_1 = require("firebase/firestore");
var api_Key = import.meta.env.VITE_FIREBASE_API_KEY;
var firebase_domain = import.meta.env.VITE_FIREBASE_DOMAIN;
// Your web app's Firebase configuration
var firebaseConfig = {
    apiKey: api_Key,
    authDomain: firebase_domain,
    projectId: "emojigenerator-f3391",
    storageBucket: "emojigenerator-f3391.firebasestorage.app",
    messagingSenderId: "12218394188",
    appId: "1:12218394188:web:8b06c590f3a812988e36e9",
    measurementId: "G-FHQQJ0V60N"
};
// Initialize Firebase
var app = (0, app_1.initializeApp)(firebaseConfig);
exports.auth = (0, auth_1.getAuth)(app);
// This project's database is named "default" (distinct from Firebase's "(default)").
var firestoreDatabaseId = ((_a = import.meta.env.VITE_FIREBASE_DATABASE_ID) === null || _a === void 0 ? void 0 : _a.trim()) || "default";
exports.db = (0, firestore_1.getFirestore)(app, firestoreDatabaseId);
// 브라우저 환경에서만 Analytics 초기화 (Vercel 서버 빌드 에러 방지)
exports.analytics = null;
if (typeof window !== "undefined") {
    (0, analytics_1.isSupported)().then(function (supported) {
        if (supported) {
            exports.analytics = (0, analytics_1.getAnalytics)(app);
        }
    });
}
