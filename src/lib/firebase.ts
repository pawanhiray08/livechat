import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, enableIndexedDbPersistence, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
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
const storage = getStorage(app);

// Initialize Firestore with better persistence settings
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true, // Add long polling for better connection stability
  cacheSizeBytes: 50000000 // Set cache size to 50MB
});

// Enable offline persistence with error handling
try {
  enableIndexedDbPersistence(db, {
    forceOwnership: false
  }).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn('Persistence disabled: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser doesn't support persistence
      console.warn('Persistence not supported by browser');
    }
  });
} catch (err) {
  console.warn('Persistence initialization error:', err);
}

export { auth, db, storage };
