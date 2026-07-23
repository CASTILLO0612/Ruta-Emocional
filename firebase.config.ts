import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAkaRxBQ6diXv2WXRb2A5SWSZzYTzvQles",
  authDomain: "ruta-emocional.firebaseapp.com",
  projectId: "ruta-emocional",
  storageBucket: "ruta-emocional.firebasestorage.app",
  messagingSenderId: "211916623343",
  appId: "1:211916623343:web:5b6508109022c3306cba1a"
};

let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);
export default app;
