import { Html, Head, Main, NextScript } from 'next/document';
import { DocumentProps } from 'next/document';
import crypto from 'crypto';

function Document(props: DocumentProps) {
  const nonce = crypto.randomBytes(16).toString('base64');

  const cspValue = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
    connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://apis.google.com wss://*.firebaseio.com;
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
