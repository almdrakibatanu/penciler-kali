export const runtime = 'edge';

// Redirect to the real brand logo. All external references (/logo in JSON-LD,
// push notification icon, favicon metadata) continue to work unchanged.
export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return Response.redirect(`${origin}/brand/logo.jpg`, 301);
}
