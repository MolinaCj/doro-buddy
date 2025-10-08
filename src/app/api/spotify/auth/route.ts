// src/app/api/spotify/auth/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_REDIRECT_URI) {
      console.error('Missing Spotify environment variables');
      return NextResponse.json(
        { error: 'Spotify configuration missing' },
        { status: 503 }
      );
    }

    const state = generateRandomString(16);
    const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative',
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      state,
    })}`;

    return NextResponse.json({ auth_url: authUrl, state });
  } catch (error) {
    console.error('Spotify auth error:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}

// Helper function for state generation
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}