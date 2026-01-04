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

        const systemPrompt = `You are a World-Class Sustainability & Product Expert AI.
    Your mission is to analyze products with extreme precision and provide high-accuracy sustainable alternatives.

    INTERNAL RAISONING RULE:
    Before suggesting any alternative, you must:
    1. Identify 2 specific material/ethical advantages over the original product.
    2. Mentally verify if the alternative is genuinely 1+ point higher in sustainability.
    3. If you lack data for a brand, do NOT suggest it.

    Output Format (JSON Only):
    {
      "score": number (0-10, 1 decimal),
      "carbon_footprint": string,
      "tags": [{"label": "string", "icon": "emoji"}],
      "certifications": ["string"],
      "material_breakdown": "string",
      "greener_alternatives": [
        {
          "name": "Specific Product Model", 
          "why": "Why it is better + matches exact function",
          "estimated_score": number (0-10, 1 decimal),
          "confidence": "high" | "medium" | "low"
        }
      ],
      "eco_brands": [
        {
          "name": "Brand Name", 
          "why": "Sustainability credentials", 
          "url": "https://official-brand-site.com",
          "estimated_score": number (0-10, 1 decimal),
          "confidence": "high" | "medium" | "low"
        }
      ]
    }
    
    CRITICAL RULES FOR ACCURACY:
    1. NO GUESSING: If you don't have verified data on a brand's sustainability (e.g., Fair Trade, GOTS, B-Corp), do not suggest it.
    2. CATEGORY LOCK: The 'eco_brands' MUST be a direct competitor in the EXACT same niche.
    3. DATA-DRIVEN SCORES: The 'estimated_score' must reflect your internal comparison of materials (e.g., recycled content, energy use, supply chain transparency).
    4. PRECISE ALTERNATIVES: Suggest only real, specific product models. No generic advice.
    5. URL INTEGRITY: Provide the OFFICIAL root domain. If unknown, leave empty.
    
    JSON ONLY. No Conversational text.`;

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
