import { Html, Head, Main, NextScript } from 'next/document';
import { DocumentProps } from 'next/document';
import crypto from 'crypto';

function Document(props: DocumentProps) {
  const nonce = crypto.randomBytes(16).toString('base64');

  const cspValue = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'nonce-${nonce}';
    script-src-elem 'self' 'unsafe-inline' https: http:;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.googleapis.com https://*.googleusercontent.com;
    font-src 'self' data: https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    media-src 'none';
    manifest-src 'self';
    worker-src 'self';
    block-all-mixed-content;
    upgrade-insecure-requests;
    connect-src 'self' 
      https://*.firebaseio.com 
      https://*.googleapis.com 
      https://apis.google.com 
      https://*.firebase.googleapis.com
      https://*.firebaseapp.com
      https://*.vercel.app
      wss://*.firebaseio.com;
  `.replace(/\s{2,}/g, ' ').trim();

  return (
    <Html>
      <Head nonce={nonce}>
        <meta httpEquiv="Content-Security-Policy" content={cspValue} />
      </Head>
      <body>
        <Main />
        <NextScript nonce={nonce} />
      </body>
    </Html>
  );
}

export default Document;
