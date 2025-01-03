import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const uid = searchParams.get('uid');
    const online = searchParams.get('online') === 'true';

    if (!uid) {
      return new NextResponse('Missing user ID', { status: 400 });
    }

    const userDocRef = doc(db, 'users', uid);
    const batch = writeBatch(db);

    batch.update(userDocRef, {
      online,
      lastSeen: serverTimestamp(),
    });

    await batch.commit();

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Error updating presence:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
