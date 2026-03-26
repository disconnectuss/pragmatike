import { createApiHandler } from 'next-api-handler';

// Get the API key from environment variables
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Proxy requests to the Anthropic API
const handler = async (req, res) => {
    const apiUrl = 'https://api.anthropic.com/v1/generate';

    const response = await fetch(apiUrl, {
        method: req.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(req.body),
    });

    if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to call Anthropic API' });
    }

    // Handle streaming responses
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done, result;
    let responseBody = '';

    while ({ done, result } = await reader.read()) {
        responseBody += decoder.decode(result, { stream: true });
        // Optionally process each chunk of data here
    }

    return res.status(200).json({ data: responseBody });
};

export default createApiHandler({ handler });