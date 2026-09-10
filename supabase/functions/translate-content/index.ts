import { protect } from '../_shared/access.ts';
import { aiFetch as fetch, getAIKey, getAIModel } from '../_shared/ai.ts';
import { serve as denoServe } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

denoServe(protect(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, targetLanguage } = await req.json();
    
    console.log('Translation request received:', { 
      contentLength: content?.length, 
      targetLanguage 
    });
    
    if (!content || !targetLanguage) {
      console.error('Missing required parameters');
      throw new Error('Content and target language are required');
    }

    const LOVABLE_API_KEY = getAIKey();
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not found in environment');
      throw new Error('LOVABLE_API_KEY not configured');
    }
    
    console.log('API key found, proceeding with translation');

    const languageNames: Record<string, string> = {
      'en': 'English',
      'it': 'Italian',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German'
    };

    const targetLangName = languageNames[targetLanguage] || targetLanguage;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the given text to ${targetLangName}. Preserve all formatting, technical terms, and structure. Return ONLY the translated text without any additional explanations or comments.`
          },
          {
            role: 'user',
            content: typeof content === 'string' ? content : JSON.stringify(content)
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI API response received');
    const translatedText = data.choices[0]?.message?.content;

    if (!translatedText) {
      console.error('No translation in response:', data);
      throw new Error('No translation returned from AI');
    }

    console.log('Translation successful, returning response');
    return new Response(
      JSON.stringify({ translatedText }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Translation failed' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}, false, true));
