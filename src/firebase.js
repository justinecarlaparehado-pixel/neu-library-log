// Import Firebase core
import { initializeApp } from "firebase/app";

// Import ONLY what you need (NO analytics)
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDjpAVdX6CsIT98PpSPCvWBCEAncmdPZQY",
  authDomain: "neu-library-log-e8e51.firebaseapp.com",
  projectId: "neu-library-log-e8e51",
  storageBucket: "neu-library-log-e8e51.firebasestorage.app",
  messagingSenderId: "807359022346",
  appId: "1:807359022346:web:da1d4f10ec4a080ee866f3"
  // ❌ REMOVE measurementId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
