import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(req: Request) {
  try {
    const { message, sessionId, history, userId } = await req.json();

    if (!message || !sessionId || !userId) {
      return NextResponse.json({ error: 'Message, sessionId, and userId are required' }, { status: 400 });
    }

    // 1. Fetch User Profile & Health Metrics from Supabase
    const { data: profile } = await supabase
      .from('wombcare_user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    const userName = profile?.name || 'User';

    // 2. Fetch Period History for Context
    const { data: periodHistory } = await supabase
      .from('wombcare_period_history')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(3);

    // 3. Save user message to Supabase (Encode userId in sender_name)
    const { error: userMsgErr } = await supabase
      .from('wombcare_live_chats')
      .insert([
        {
          user_id: sessionId,
          sender_name: `User:${userId}:${userName}`,
          sender_role: 'user',
          message: message,
        },
      ]);

    if (userMsgErr) {
      console.error('Error saving user message to Supabase:', userMsgErr);
    }

    // 4. Formulate System Prompt with Health context
    let healthContext = '';
    if (profile) {
      healthContext = `
[USER HEALTH METRICS & CONTEXT]
- Name: ${profile.name}
- Age: ${profile.age || 'Not specified'}
- Wellness Goal: ${profile.wellness_goal || 'General Health'}
- Weight: ${profile.weight ? profile.weight + ' kg' : 'Not specified'}
- BMI: ${profile.bmi || 'Not specified'}
- Wellness Score: ${profile.wellness_score || 'Not specified'}
- Sleep: ${profile.sleep ? profile.sleep + ' hours' : 'Not specified'}
- Today's Water Intake: ${profile.water_intake || 0} / ${profile.target_water || 8} glasses
- Cycle Day: ${profile.cycle_day || 'Not tracked'}
- Cycle Length: ${profile.cycle_length || 28} days
- Next Expected Period: ${profile.next_period_date || 'Not specified'}
- Logged Symptoms: ${JSON.stringify(profile.symptoms || {})}
- Current Mood: ${profile.mood || 'Not logged'}
- Personal Notes: ${profile.personal_notes || 'None'}
- Doctor's Notes: ${profile.doctor_note || 'None'}
`;
    }

    if (periodHistory && periodHistory.length > 0) {
      healthContext += `\n[PERIOD HISTORY LOGS]\n` + periodHistory.map((ph: any) => 
        `- Period Start: ${ph.start_date}, End: ${ph.end_date || 'Ongoing'}, Flow Intensity: ${ph.flow_intensity || 'Normal'}, Pain Level: ${ph.pain_level || 'None'}`
      ).join('\n');
    }

    const systemPrompt = `You are Divya, an empathetic, supportive, and highly knowledgeable AI health assistant for Wombcare, a platform specializing in PCOS, PCOD, PMS, menstrual health, and women's hormonal balance.
    
Your goal is to assist the user by analyzing their health metrics, cycle history, and lifestyle trackers (like water intake and sleep) to provide hyper-personalized wellness advice.

${healthContext}

Guidelines:
1. Always be warm, supportive, and encouraging. Address the user by their name (${userName}) naturally.
2. Refer to their current logs (e.g. water intake, sleep, symptoms) to answer queries. If they ask "how is my health looking?" or "how is my period cycle?", use the provided metrics to analyze and give advice.
3. Keep answers concise, clear, and easy to read. Use bullet points and clean structure.
4. IMPORTANT: Include a brief disclaimer at the end of responses requiring advice: "Disclaimer: I am Divya, your AI wellness coach. My advice is based on wellness and lifestyle metrics and does not replace medical consultation. Always consult Wombcare doctors or your healthcare provider for medical diagnosis."
5. Do not use gradients in your text or formatting. Keep the tone premium, expert, yet approachable.`;

    // Map history to Gemini API structure
    const contents = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      return NextResponse.json({ error: 'Failed to generate response from AI' }, { status: 500 });
    }

    const data = await response.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (replyText) {
      // 5. Save assistant message to Supabase (Encode userId in sender_name)
      const { error: assistantMsgErr } = await supabase
        .from('wombcare_live_chats')
        .insert([
          {
            user_id: sessionId,
            sender_name: `Divya:${userId}`,
            sender_role: 'doctor',
            message: replyText,
          },
        ]);

      if (assistantMsgErr) {
        console.error('Error saving assistant response to Supabase:', assistantMsgErr);
      }
    }

    return NextResponse.json({ reply: replyText });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
