export async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text || !text.trim()) {
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status} (${res.statusText || 'No response body'})`);
    }
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      // If server returned HTML (e.g. 404/502 page from proxy)
      const cleanSnippet = text.replace(/<[^>]*>?/gm, '').trim().slice(0, 120);
      throw new Error(`Server error (${res.status}): ${cleanSnippet || res.statusText}`);
    }
    throw new Error(`Unexpected non-JSON response from server (HTTP ${res.status})`);
  }
}
