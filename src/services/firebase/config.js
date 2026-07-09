import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCbtLATi5sFP0IDgdVoPp8uWXr1KKoa9y8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ensamblesmart.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ensamblesmart",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ensamblesmart.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1098932739718",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1098932739718:web:10227cba09af843e563b07",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
