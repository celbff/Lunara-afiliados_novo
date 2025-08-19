// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/imagens/logo.webp" type="image/webp" />
        <meta name="theme-color" content="#004a6c" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}