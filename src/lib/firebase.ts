import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyD3Yl0BR4o6qEX6MeXYjX6Qjlr5BCid5C8",
  authDomain: "my-website-242fc.firebaseapp.com",
  projectId: "my-website-242fc",
  storageBucket: "my-website-242fc.firebasestorage.app",
  messagingSenderId: "78108710064",
  appId: "1:78108710064:web:7b5e79f33721fbc7f71775"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

