export function validateRequest(body) {
  const { prompt, model, max_tokens } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return { valid: false, error: 'Prompt is required and cannot be empty' };
  }

  if (prompt.length > 10000) {
    return { valid: false, error: 'Prompt too long (max 10,000 chars)' };
  }

  const allowedModels = [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-5-20251101'
  ];
  
  if (model && !allowedModels.includes(model)) {
    return { valid: false, error: 'Invalid model specified' };
  }

  if (max_tokens !== undefined) {
    if (typeof max_tokens !== 'number' || max_tokens < 1 || max_tokens > 2000) {
      return { valid: false, error: 'max_tokens must be between 1 and 2000' };
    }
  }

  return { valid: true };
}
