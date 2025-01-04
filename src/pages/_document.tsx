import { Html, Head, Main, NextScript } from 'next/document';
import { DocumentProps } from 'next/document';

function Document(props: DocumentProps) {
  return (
    <Html>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

export default Document;
