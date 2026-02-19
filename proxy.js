export async function callAnthropic(apiKey, requestBody) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: requestBody.model || 'claude-haiku-4-5-20251001',
        max_tokens: Math.min(requestBody.max_tokens || 1500, 2000),
        messages: [{ role: 'user', content: requestBody.prompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: { message: response.statusText } 
      }));
      
      const error = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.type = errorData.error?.type;
      throw error;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout after 30s');
    }
    throw error;
  }
}
