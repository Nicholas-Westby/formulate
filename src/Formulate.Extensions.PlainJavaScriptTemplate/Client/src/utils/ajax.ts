/** How long a submission may take before it is abandoned (and treated as failed). */
const requestTimeoutMilliseconds = 60_000;

/**
 * Posts form data to the server and resolves to the response text. Rejects when
 * the request fails, takes longer than a minute, or the server responds with an
 * error status.
 */
export async function postFormData(url: string, data: FormData): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    body: data,
    // The antiforgery cookie must be sent along with the token in the payload.
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(requestTimeoutMilliseconds),
  });
  if (!response.ok) {
    throw new Error(`The server responded with status ${response.status}.`);
  }
  return response.text();
}
