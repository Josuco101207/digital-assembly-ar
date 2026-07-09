import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDWOFFslHI0eSqyUf_tb1D1VlzMZmNemmM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "inventor-manager-a0b4d.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "inventor-manager-a0b4d",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "inventor-manager-a0b4d.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "213399034117",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:213399034117:web:4311dbe23b8d51f6fe7f6c",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
