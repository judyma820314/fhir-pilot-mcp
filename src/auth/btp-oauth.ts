export interface BtpTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export async function getBtpToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  scope = '',
): Promise<BtpTokenResponse> {
  const params: Record<string, string> = {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  };
  if (scope) params.scope = scope;
  const body = new URLSearchParams(params);

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`BTP token request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<BtpTokenResponse>;
}
