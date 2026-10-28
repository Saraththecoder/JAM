import { NextResponse, type NextRequest } from 'next/server';
import { getAppUrl, getAuth, getProfile, jsonError, logError, parseJson } from '@/lib/api';
import { aiGenerationLimiter } from '@/lib/rate-limit';
import { aiGenerationSchema } from '@/lib/validation';

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { message?: unknown };
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) return jsonError('Unauthorized.', 401);

    const limit = await aiGenerationLimiter.limit(user.id);
    if (!limit.success) {
      return jsonError('Too many AI generation requests. Please wait a minute and try again.', 429);
    }

    const profile = await getProfile(user.id);
    if (!profile || profile.role !== 'student' || !profile.is_approved) {
      return jsonError('Only approved students can use AI letter drafting.', 403);
    }

    const parsed = await parseJson(request, aiGenerationSchema);
    if (!parsed.ok) return parsed.response;

    const { description, tone, openRouterKey } = parsed.data;
    const openRouterUrl =
      (process.env.OPENROUTER_API_URL || process.env.NEXT_PUBLIC_OPENROUTER_API_URL)?.replace(
        /\/$/,
        ''
      ) || 'https://openrouter.ai/api/v1';

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

    let apiResponse: Response;
    try {
      apiResponse = await fetch(`${openRouterUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterKey}`,
          'HTTP-Referer': getAppUrl(request),
          'X-Title': 'Campus Letter Automation Platform',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Generate the letter body paragraphs based on the instruction.' },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      logError('generate-ai-body.fetch', error);
      return jsonError('The AI service did not respond in time. Please try again.', 504);
    }

    let data: OpenRouterResponse | null = null;
    try {
      data = (await apiResponse.json()) as OpenRouterResponse;
    } catch {
      data = null;
    }

    if (!apiResponse.ok) {
      logError('generate-ai-body.provider', { status: apiResponse.status });
      if (apiResponse.status === 401 || apiResponse.status === 403) {
        return jsonError('The AI provider rejected your API key. Check the key and try again.', 401);
      }
      if (apiResponse.status === 429) {
        return jsonError('The AI provider is rate limiting this key. Please wait and try again.', 429);
      }
      return jsonError('The AI provider could not generate the letter body. Please try again.', 502);
    }

    const generatedText = data?.choices?.[0]?.message?.content;
    if (typeof generatedText !== 'string' || !generatedText.trim()) {
      return jsonError('The AI provider returned an empty response. Please try again.', 502);
    }

    const body = generatedText.trim();
    if (body.length > 8000) {
      return jsonError('The generated letter is too long. Please shorten the description and try again.', 400);
    }

    return NextResponse.json({ body });
  } catch (error) {
    logError('generate-ai-body', error);
    return jsonError('Unable to generate the letter body. Please try again.', 500);
  }
}
