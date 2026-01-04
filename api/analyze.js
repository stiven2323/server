export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    // CORS Headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    try {
        const { productName, ingredientsText } = await request.json();

        if (!process.env.GROQ_API_KEY) {
            throw new Error('Server misconfiguration: API Key missing');
        }

        const systemPrompt = `You are EcoLens AI, a sustainability expert.

    Analyze the product and suggest better alternatives.

    JSON FORMAT:
    {
      "score": number (0-10, 1 decimal),
      "carbon_footprint": "X kg CO2e",
      "carbon_comparison": "Equivalent to X miles driven" (use relatable metaphors),
      "emotional_message": "Motivational message based on score",
      "tags": [{"label": "string", "icon": "emoji"}],
      "certifications": ["string"],
      "greener_alternatives": [
        {
          "name": "Product Name",
          "analyzed_score": number (0-10, your best estimate),
          "why": "Brief reason",
          "url": "https://site.com"
        }
      ],
      "eco_brands": [
        {
          "name": "Brand Name",
          "analyzed_score": number (0-10, your best estimate),
          "why": "Why sustainable",
          "url": "https://site.com"
        }
      ]
    }

    RULES:
    1. For alternatives/brands: provide analyzed_score based on your knowledge
    2. Emotional messages:
       - Score 0-5: "⚠️ High impact. Let's find better!"
       - Score 5-7.9: "🌱 Good start! Can improve."
       - Score 8-10: "✨ Excellent choice!"
    3. Carbon: use metaphors (miles driven, phones charged, trees)
    4. Only suggest alternatives 1+ points better
    5. Same category only (electronics → electronics)

    JSON ONLY.`;

        const userPrompt = `Product: ${productName}\nDescription/Ingredients: ${ingredientsText}`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.5,
                max_tokens: 800,
                response_format: { type: 'json_object' },
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Groq API Error');
        }

        const contentString = data.choices?.[0]?.message?.content;
        if (!contentString) {
            throw new Error('Groq returned empty response');
        }

        // Parse the inner JSON string from Groq
        const parsedContent = JSON.parse(contentString);

        return new Response(JSON.stringify(parsedContent), {
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
