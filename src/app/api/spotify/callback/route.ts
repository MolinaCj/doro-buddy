import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle auth errors
    if (error) {
      console.error('Spotify auth error:', error);
      return new NextResponse(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_ERROR',
                error: '${error}'
              }, window.location.origin);
              window.close();
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    if (!code) {
      return new NextResponse(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_ERROR',
                error: 'No authorization code received'
              }, window.location.origin);
              window.close();
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Check environment variables
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET || !process.env.SPOTIFY_REDIRECT_URI) {
      console.error('Missing Spotify environment variables');
      return new NextResponse(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_ERROR',
                error: 'Server configuration error'
              }, window.location.origin);
              window.close();
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const supabase = createRouteHandlerClient({ cookies });

    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return new NextResponse(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_ERROR',
                error: 'Token exchange failed: ${errorData.error || 'Unknown error'}'
              }, window.location.origin);
              window.close();
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const tokens = await tokenResponse.json();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('User not authenticated:', authError);
      return new NextResponse(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_ERROR',
                error: 'User not authenticated'
              }, window.location.origin);
              window.close();
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Store tokens
    const { error: dbError } = await supabase
      .from('spotify_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope,
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new NextResponse(`
        <html>
          <body>
            <script>
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_ERROR',
                error: 'Failed to save tokens'
              }, window.location.origin);
              window.close();
            </script>
          </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Success - notify parent window
    return new NextResponse(`
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'SPOTIFY_AUTH_SUCCESS'
            }, window.location.origin);
            window.close();
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Spotify callback error:', error);
    return new NextResponse(`
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'SPOTIFY_AUTH_ERROR',
              error: 'Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}'
            }, window.location.origin);
            window.close();
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}