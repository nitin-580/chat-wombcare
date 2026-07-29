import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const { data: profile, error } = await supabase
      .from('wombcare_user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error('Profile API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
