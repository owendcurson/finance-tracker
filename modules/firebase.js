import { initializeApp }                   from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
         OAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         signOut, deleteUser, sendPasswordResetEmail,
         setPersistence, browserLocalPersistence, browserSessionPersistence }
  from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';

const app = initializeApp({
  apiKey:            'AIzaSyCrh8OV_QoOeygio4LhqXWk10vQcxHHn4I',
  authDomain:        'financial-tracker-f8d47.firebaseapp.com',
  projectId:         'financial-tracker-f8d47',
  storageBucket:     'financial-tracker-f8d47.firebasestorage.app',
  messagingSenderId: '626879548091',
  appId:             '1:626879548091:web:7cff4521a13b4744c6b79e',
  measurementId:     'G-N6Z2DLR94L',
});

export const auth             = getAuth(app);
export const db               = getFirestore(app);
export const googleProvider   = new GoogleAuthProvider();
export const microsoftProvider= new OAuthProvider('microsoft.com');

export {
  onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, deleteUser, sendPasswordResetEmail,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
  collection, doc, setDoc, getDoc, getDocs, deleteDoc,
};
