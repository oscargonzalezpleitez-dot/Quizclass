import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Firebase Storage NO se usa — selfies guardadas en base64 en Firestore (sin costo adicional)
const firebaseConfig = {
  apiKey: "AIzaSyD3VmWEZ_nvZ8sWeJZa7acr2vBn28WynIo",
  authDomain: "quizclass-usam-pro.firebaseapp.com",
  projectId: "quizclass-usam-pro",
  storageBucket: "quizclass-usam-pro.firebasestorage.app",
  messagingSenderId: "28883010942",
  appId: "1:28883010942:web:86832255ae2cef656a5f2f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
