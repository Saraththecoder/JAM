import { NextRequest, NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase/server';
import { aiGenerationLimiter } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientServer();
    const { data: { user } } = await supabase.auth.getUser();
    const identifier = user?.id || request.headers.get('x-forwarded-for') || '127.0.0.1';

    const limitCheck = await aiGenerationLimiter.limit(identifier);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before generating another letter.' },
        { status: 429 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { description, tone, openRouterKey } = await request.json();

    if (!openRouterKey) {
      return NextResponse.json(
        { error: 'OpenRouter API Key is missing. Please provide your API key to generate an AI-assisted letter.' },
        { status: 400 }
      );
    }

    if (!description || !tone) {
      return NextResponse.json(
        { error: 'Description and tone are required' },
        { status: 400 }
      );
    }

    const openRouterUrl = process.env.NEXT_PUBLIC_OPENROUTER_API_URL || 'https://openrouter.ai/api/v1';

    const systemPrompt = `You are an AI assistant helping a college student write the body paragraphs of a formal letter to their department faculty.
    
CRITICAL INSTRUCTION: Write ONLY the body paragraphs of the letter.
- Do NOT include any address blocks (To/From).
- Do NOT include a date.
- Do NOT include a subject line.
- Do NOT include salutations (like "Respected Sir" or "Dear Faculty").
- Do NOT include closing sign-offs (like "Yours obediently" or "Thanking you").
- Write ONLY the core explanation paragraphs.
- Tone: ${tone === 'formal' ? 'Extremely formal, respectful, and polite' : 'Polite, earnest, and clear but slightly less rigid'}.

Student's prompt / details: ${description}`;

    // Call OpenRouter API using student's BYOK key
    const apiResponse = await fetch(`${openRouterUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': request.headers.get('referer') || 'https://campus-letter-tpt.vercel.app',
        'X-Title': 'Campus Letter Automation Platform',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Standard high-quality model for text generation
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the letter body paragraphs based on the instruction.' }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('OpenRouter error response:', data);
      const errorMessage = data?.error?.message || 'OpenRouter API call failed.';
      return NextResponse.json(
        { error: `OpenRouter Error: ${errorMessage}` },
        { status: apiResponse.status }
      );
    }

    const generatedText = data?.choices?.[0]?.message?.content?.trim();
    if (!generatedText) {
      throw new Error('No content returned from OpenRouter.');
    }

    return NextResponse.json({ body: generatedText });
  } catch (error: any) {
    console.error('Unexpected AI letter generation error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
