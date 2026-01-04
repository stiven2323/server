export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await request.json();
    const { productName, ingredientsText } = body;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { 
            role: 'system', 
            content: 'Analyze product sustainability. Return JSON ONLY: { "score": 0-10, "carbon_footprint": "kg", "carbon_comparison": "string", "emotional_message": "string", "tags": [{"label": "string", "icon": "emoji"}], "certifications": [], "greener_alternatives": [{"name": "string", "analyzed_score": 0-10, "why": "string"}], "eco_brands": [] }' 
          },
          { role: 'user', content: `Product: ${productName}. Details: ${ingredientsText}` }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Groq Error');

    // EXTRAE SOLO EL JSON LIMPIO
    const contentString = data.choices[0].message.content;

    return new Response(contentString, {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
