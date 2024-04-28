import type { EntryContext } from '@netlify/remix-runtime';
import { RemixServer } from '@remix-run/react';
import isbot from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { createContentSecurityPolicy } from '@shopify/hydrogen';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {

  const body = await renderToReadableStream(
    <RemixServer context={remixContext} url={request.url} />
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');


  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
