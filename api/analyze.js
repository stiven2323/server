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
            throw new Error('Server Key Missing');
        }

        const systemPrompt = `You are EcoLens AI. Analyze the product sustainability.
    Return JSON ONLY:
    {
      "score": number (0-10),
      "carbon_footprint": "string",
      "tags": [{"label": "string", "icon": "emoji"}],
      "certifications": ["string"],
      "greener_alternatives": [{"name": "string", "why": "string", "url": "string"}],
      "eco_brands": [{"name": "string", "why": "string", "url": "string"}]
    }`;

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
                    { role: 'user', content: `Product: ${productName}. Details: ${ingredientsText}` },
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' },
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Groq Error');

        const content = data.choices[0].message.content;

        // Safety JSON extraction
        const jsonMatch = content.match(/\{[\s\S]*\}/);
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
