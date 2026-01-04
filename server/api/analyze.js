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

    Output Format (JSON Only):
    {
      "score": number (0-10, 1 decimal),
      "carbon_footprint": string,
      "tags": [{"label": "string", "icon": "emoji"}],
      "certifications": ["string"],
      "material_breakdown": "string",
      "greener_alternatives": [
        {"name": "Specific Product Model", "why": "Why it is better + matches exact function"}
      ],
      "eco_brands": [
        {"name": "Brand Name", "why": "Sustainability credentials", "url": "https://official-brand-site.com"}
      ]
    }
    
    CRITICAL RULES FOR ACCURACY:
    1. CATEGORY LOCK: The 'eco_brands' MUST be a direct competitor within the EXACT same niche.
       - If product is MEDICAL/DISABILITY: Suggest only medical/mobility brands (e.g., Sunrise Medical, Invacare).
       - If product is ELECTRONICS: Suggest only tech brands (e.g., Framework, Fairphone).
    2. FUNCTIONAL EQUIVALENCE: The 'greener_alternative' MUST allow the user to perform the same task.
    3. BRAND AUTHENTICITY: Suggest only real brands with verified sustainability credentials.
    4. URL INTEGRITY: Provide the OFFICIAL root domain. If unknown, leave empty.
    
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

        return new Response(JSON.stringify(data), {
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
