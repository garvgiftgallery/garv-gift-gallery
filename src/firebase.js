// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth"; 
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAvLHaQQ9k6HTmm8G5DdxHT2oIKk2tSXhY",
  authDomain: "garv-gift-gallery.firebaseapp.com",
  projectId: "garv-gift-gallery",
  storageBucket: "garv-gift-gallery.firebasestorage.app",
  messagingSenderId: "423716897043",
  appId: "1:423716897043:web:aa85c118e8080ad2c91ae6",
  measurementId: "G-FW4403T593"
};

/*
  const firebaseConfig = {
  apiKey: "AIzaSyB3nVtlfp22Gv_y5X6dB0kFYbwZG0KhP7M",
  authDomain: "garv-51679.firebaseapp.com",
  projectId: "garv-51679",
  storageBucket: "garv-51679.firebasestorage.app",
  messagingSenderId: "234622283281",
  appId: "1:234622283281:web:814e4e11035d3621268bb0",
  measurementId: "G-FW4403T593"
};
*/
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
