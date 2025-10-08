import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Check environment variables first
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'Service configuration error' }, { status: 503 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Default to last 365 days if no dates provided
    const defaultEndDate = new Date();
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultEndDate.getDate() - 365);

    const queryStartDate = startDate || defaultStartDate.toISOString().split('T')[0];
    const queryEndDate = endDate || defaultEndDate.toISOString().split('T')[0];

    // Get session data from the database
    const { data: sessions, error } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', queryStartDate)
      .lte('created_at', queryEndDate)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json({ error: 'Failed to fetch session data' }, { status: 500 });
    }

    console.log(`Found ${sessions?.length || 0} sessions for user ${user.id}`);

    // Group sessions by date
    const dailyData = new Map<string, { count: number; intensity: number }>();
    
    if (sessions && sessions.length > 0) {
      sessions.forEach(session => {
        const date = new Date(session.created_at).toISOString().split('T')[0];
        const existing = dailyData.get(date) || { count: 0, intensity: 0 };
        existing.count += 1;
        dailyData.set(date, existing);
      });
    }

    // Calculate intensity levels and streaks
    const data = Array.from(dailyData.entries()).map(([date, stats]) => ({
      date,
      count: stats.count,
      intensity: Math.min(4, Math.floor(stats.count / 2) + 1), // Scale intensity based on count
    }));

    // Calculate streaks
    const sortedDates = Array.from(dailyData.keys()).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date().toISOString().split('T')[0];

    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const date = sortedDates[i];
      const hasActivity = (dailyData.get(date)?.count ?? 0) > 0;
      
      if (hasActivity) {
        tempStreak++;
        if (date === today || date < today) {
          currentStreak = tempStreak;
        }
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 0;
      }
    }
    
    longestStreak = Math.max(longestStreak, tempStreak);
    const totalSessions = data.reduce((sum, day) => sum + day.count, 0);

    return NextResponse.json({
      data,
      start_date: queryStartDate,
      end_date: queryEndDate,
      total_sessions: totalSessions,
      current_streak: currentStreak,
      longest_streak: longestStreak,
    });

  } catch (error) {
    console.error('Error in heatmap API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
