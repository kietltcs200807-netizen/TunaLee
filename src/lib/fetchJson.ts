export async function fetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const text = await res.text();

  let data: any;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error: any) {
    const htmlStart = text.slice(0, 20).replace(/\n/g, " ");
    throw new Error(
      `Invalid JSON response from ${typeof input === "string" ? input : "URL"} (status: ${res.status}) - ${error.message}. Response starts with: ${htmlStart}`
    );
  }

  if (!res.ok) {
    const message = data && typeof data === "object" && data.error ? data.error : `HTTP ${res.status}`;
    throw new Error(`Request failed: ${message}`);
  }

  return data;
}
