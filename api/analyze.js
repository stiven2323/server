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
        const { productName, ingredientsText } = await request.json();

        if (!process.env.GROQ_API_KEY) {
            throw new Error('Server misconfiguration: API Key missing');
        }

        const systemPrompt = `You are EcoLens AI, the world's most advanced sustainable shopping assistant.
    Analyze the product and suggest better alternatives.
    FORMAT (JSON Only):
    {
      "score": number (0-10, 1 decimal),
      "carbon_footprint": "X kg CO2e",
      "carbon_comparison": "Equivalent to X miles driven",
      "emotional_message": "Motivational message based on score",
      "tags": [{"label": "string", "icon": "emoji"}],
      "certifications": ["string"],
      "greener_alternatives": [
        {
          "name": "Product Name",
          "analyzed_score": number (0-10),
          "why": "Brief reason (max 12 words)",
          "url": "https://site.com"
        }
      ],
      "eco_brands": [
        {
          "name": "Brand Name",
          "analyzed_score": number (0-10),
          "why": "Why sustainable (max 12 words)",
          "url": "https://brand.com"
        }
      ]
    }
    RULES:
    1. Analysis: Calculate score (0-10). 
    2. Emotional Messages: 0-5.0 (Red), 5.1-7.9 (Yellow), 8.0-10 (Green).
    3. Category lock: Electronics with electronics, etc.
    4. JSON ONLY.`;

        const userPrompt = \`Product: \${productName}\\nDetails: \${ingredientsText}\`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${process.env.GROQ_API_KEY}\`,
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 1000,
                response_format: { type: 'json_object' },
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Groq API Error');

        const content = data.choices[0].message.content;
        
        // Robust JSON extraction
        const jsonMatch = content.match(/\\{[\\s\\S]*\\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : content;

        return new Response(cleanJson, {
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
