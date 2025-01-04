import { Html, Head, Main, NextScript } from 'next/document';
import { DocumentProps } from 'next/document';

function Document(props: DocumentProps) {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <meta name="description" content="Real-time chat application with instant messaging capabilities" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Preload critical resources */}
        <link rel="preconnect" href="https://apis.google.com" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="dns-prefetch" href="https://firestore.googleapis.com" />
        
        {/* Prevent flash of unstyled content */}
        <style dangerouslySetInnerHTML={{ __html: `
          body { margin: 0; }
          * { box-sizing: border-box; }
        ` }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

export default Document;
