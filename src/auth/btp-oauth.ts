export interface BtpTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// TODO: Replace with real OAuth 2.0 client credentials grant:
//   POST {tokenUrl}
//   Content-Type: application/x-www-form-urlencoded
//   Body: grant_type=client_credentials&client_id=...&client_secret=...
export async function getBtpToken(
  _tokenUrl: string,
  _clientId: string,
  _clientSecret: string,
  scope = 'openid',
): Promise<BtpTokenResponse> {
  console.warn('[MOCK] getBtpToken — returning mock token');
  return {
    access_token: `mock-token-${Date.now()}`,
    token_type: 'Bearer',
    expires_in: 3600,
    scope,
  };
}
