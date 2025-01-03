# Realtime Chat Application

A modern real-time chat application built with Next.js, Firebase, and TailwindCSS. Features include:

- Real-time messaging with typing indicators
- Google authentication
- Mobile-responsive design
- Multiple chat conversations
- Modern UI with TailwindCSS

## Technologies Used

- Next.js 14
- Firebase (Authentication & Firestore)
- TailwindCSS
- TypeScript
- React Firebase Hooks

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser.

## Features

- **Real-time Chat**: Messages appear instantly with typing indicators
- **Google Authentication**: Secure login with Google
- **Multiple Conversations**: Chat with multiple users
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean and intuitive interface

## Deployment

The application is ready to be deployed on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in Vercel
4. Deploy!
