import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, initializeFirestore, enableIndexedDbPersistence, persistentLocalCache, persistentMultipleTabManager, clearIndexedDbPersistence } from 'firebase/firestore';
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

// Set authentication persistence to local storage
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Authentication persistence set to local storage');
  })
  .catch((error) => {
    console.error('Error setting auth persistence:', error);
  });

const storage = getStorage(app);

// Initialize Firestore with optimized settings for chat applications
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    cacheSizeBytes: 100000000 // Increased cache size to 100MB for better chat performance
  }),
  // Remove experimentalForceLongPolling as it can cause connection issues
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

// Export initialized services
export { auth, db, storage };

// Export a function to clear cache if needed
export const clearFirestoreCache = async () => {
  try {
    await clearIndexedDbPersistence(db);
    console.log('Firestore cache cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing Firestore cache:', error);
    return false;
  }
};

// Export Google sign-in function
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    // Using popup-based sign-in for better cookie compliance
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};
