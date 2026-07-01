// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; 

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAvLHaQQ9k6HTmm8G5DdxHT2oIKk2tSXhY",
  authDomain: "garv-gift-gallery.firebaseapp.com",
  projectId: "garv-gift-gallery",
  storageBucket: "garv-gift-gallery.firebasestorage.app",
  messagingSenderId: "423716897043",
  appId: "1:423716897043:web:aa85c118e8080ad2c91ae6"
  // Your config variables will go here
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ✨ FIXED: Initialize Firestore WITH Offline Persistence (Removed the duplicate getFirestore)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const storage = getStorage(app);
export const auth = getAuth(app);