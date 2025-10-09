import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: tokens } = await supabase
      .from('spotify_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!tokens || !tokens.access_token) {
      return NextResponse.json({ error: 'No Spotify tokens found' }, { status: 404 })
    }

    // Check if token is expired
    if (new Date(tokens.expires_at) <= new Date()) {
      // Try to refresh token
      const refreshed = await refreshSpotifyToken(tokens.refresh_token)
      if (refreshed) {
        // Update database with new token
        await supabase
          .from('spotify_tokens')
          .update({
            access_token: refreshed.access_token,
            expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          })
          .eq('user_id', user.id)

        return NextResponse.json({ access_token: refreshed.access_token })
      } else {
        return NextResponse.json({ error: 'Token expired and refresh failed' }, { status: 401 })
      }
    }

    return NextResponse.json({ access_token: tokens.access_token })
  } catch (error) {
    console.error('Token retrieval error:', error)
    return NextResponse.json({ error: 'Failed to get token' }, { status: 500 })
  }
}

async function refreshSpotifyToken(refreshToken: string) {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (response.ok) {
      return await response.json()
    }
    return null
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}