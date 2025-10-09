import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ connected: false, error: 'Service configuration error' });
    }

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ connected: false, error: 'Authentication failed' });
    }
    
    if (!user) {
      return NextResponse.json({ connected: false })
    }

    const { data: tokens } = await supabase
      .from('spotify_tokens')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .single()

    const connected = tokens && tokens.access_token && new Date(tokens.expires_at) > new Date()
    
    return NextResponse.json({ connected: !!connected })
  } catch (error) {
    return NextResponse.json({ connected: false })
  }
}