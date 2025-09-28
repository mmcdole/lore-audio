import { NextRequest, NextResponse } from 'next/server';

// Development admin token - in production this should be handled differently
let DEV_AUTH_TOKEN: string | null = null;

// Get auth token from backend
async function getDevAuthToken(): Promise<string> {
  if (DEV_AUTH_TOKEN) {
    return DEV_AUTH_TOKEN;
  }

  try {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate');
    }

    const data = await response.json();
    DEV_AUTH_TOKEN = data.data.api_key;
    return DEV_AUTH_TOKEN;
  } catch (error) {
    console.error('Failed to get dev auth token:', error);
    throw error;
  }
}

export async function middleware(request: NextRequest) {
  // Only intercept API requests
  if (request.nextUrl.pathname.startsWith('/api/')) {
    try {
      // Get the auth token
      const token = await getDevAuthToken();

      // Create a new request with the Authorization header
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('Authorization', `Bearer ${token}`);

      // Create a new request with the modified headers
      return NextResponse.rewrite(request.url, {
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      console.error('Middleware auth error:', error);
      // Continue without auth - let the backend handle the error
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};