import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyC0CoKqFonQmdyJ1k7f6pc77KyV3cFCUSM",
  authDomain: "live-chat-pro-c0934.firebaseapp.com",
  projectId: "live-chat-pro-c0934",
  storageBucket: "live-chat-pro-c0934.firebasestorage.app",
  messagingSenderId: "137170883311",
  appId: "1:137170883311:web:a4616450f1cdab08f7c11a",
  databaseURL: `https://live-chat-pro-c0934.firebaseio.com`
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize services
const auth = getAuth(app);
let db;
const storage = getStorage(app);

// Enable offline persistence
const initializeFirebase = async () => {
  try {
    db = initializeFirestore(app, { experimentalForceLongPolling: true });
    await enableIndexedDbPersistence(db);
    console.log('Offline persistence enabled');
  } catch (err) {
    console.error('Error initializing Firebase:', err);
  }
};

// Initialize Firebase features
initializeFirebase().catch(console.error);

export { auth, db, storage };
