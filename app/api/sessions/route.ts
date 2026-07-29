import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');

    if (sessionId) {
      // Fetch messages for a specific session
      const { data: messages, error } = await supabase
        .from('wombcare_live_chats')
        .select('*')
        .eq('user_id', sessionId)
        .is('class_id', null)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      // Map back to front-end message structure
      const mappedMessages = (messages || []).map((m: any) => {
        // Parse original sender name if formatted as sender:userId:name
        let cleanSender = m.sender_name;
        if (m.sender_name.startsWith('User:')) {
          const parts = m.sender_name.split(':');
          cleanSender = parts[2] || 'User';
        } else if (m.sender_name.startsWith('Divya:')) {
          cleanSender = 'Divya';
        }

        return {
          id: m.id,
          role: m.sender_role === 'user' ? 'user' : 'model',
          sender: cleanSender,
          content: m.message,
          createdAt: m.created_at,
        };
      });

      return NextResponse.json({ messages: mappedMessages });
    } else {
      // Fetch assistant messages filtered by user
      let query = supabase
        .from('wombcare_live_chats')
        .select('user_id, message, sender_name, sender_role, created_at')
        .is('class_id', null)
        .order('created_at', { ascending: true });

      if (userId) {
        query = query.ilike('sender_name', `%${userId}%`);
      }

      const { data: messages, error } = await query;

      if (error) {
        throw error;
      }

      // Group by user_id
      const sessionsMap: Record<string, { id: string; title: string; createdAt: string }> = {};

      (messages || []).forEach((m: any) => {
        const id = m.user_id;
        if (!sessionsMap[id]) {
          // Use first user message as title, default to 'New Chat'
          let title = 'New Conversation';
          if (m.sender_role === 'user') {
            title = m.message.length > 35 ? m.message.substring(0, 35) + '...' : m.message;
          }
          sessionsMap[id] = {
            id,
            title,
            createdAt: m.created_at,
          };
        } else {
          // If title was set to default and this is the first user message, update it
          if (sessionsMap[id].title === 'New Conversation' && m.sender_role === 'user') {
            sessionsMap[id].title = m.message.length > 35 ? m.message.substring(0, 35) + '...' : m.message;
          }
        }
      });

      // Convert map to sorted array (latest first)
      const sessionsList = Object.values(sessionsMap).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return NextResponse.json({ sessions: sessionsList });
    }
  } catch (error: any) {
    console.error('Sessions API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('wombcare_live_chats')
      .delete()
      .eq('user_id', sessionId)
      .is('class_id', null);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Sessions Delete Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
