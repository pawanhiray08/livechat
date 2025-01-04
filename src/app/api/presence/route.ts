import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { initAdmin } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idToken = searchParams.get('idToken');

    if (!idToken) {
      return NextResponse.json({ error: 'No ID token provided' }, { status: 400 });
    }

    // Initialize Firebase Admin
    initAdmin();

    // Verify the ID token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Update presence in Realtime Database
    const db = getDatabase();
    const userStatusRef = db.ref(`/status/${uid}`);
    
    const status = {
      state: 'online',
      last_changed: new Date().toISOString(),
    };

    await userStatusRef.set(status);

    return NextResponse.json({ status: 'Success', uid });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}
