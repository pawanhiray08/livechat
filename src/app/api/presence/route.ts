import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { uid, status } = await request.json();

    if (!uid) {
      return NextResponse.json({ error: 'No user ID provided' }, { status: 400 });
    }

    const userStatusRef = doc(db, 'status', uid);
    await setDoc(userStatusRef, {
      state: status || 'online',
      lastSeen: serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ status: 'Success', uid });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json(
      { error: 'Failed to update presence' },
      { status: 500 }
    );
  }
}
