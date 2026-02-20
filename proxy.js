export async function callAnthropic(apiKey, requestBody) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    // Using Groq API (free alternative to Anthropic)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Free Groq model
        messages: [{ role: 'user', content: requestBody.prompt }],
        max_tokens: Math.min(requestBody.max_tokens || 1500, 2000),
        temperature: 0.7
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

    const data = await response.json();
    
    // Convert Groq response format to Anthropic-compatible format
    return {
      id: data.id,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: data.choices[0].message.content
        }
      ],
      model: data.model,
      stop_reason: data.choices[0].finish_reason
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout after 30s');
    }
    throw error;
  }
}
