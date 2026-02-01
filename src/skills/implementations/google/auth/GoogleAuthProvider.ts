import { google, Auth } from "googleapis";

export class GoogleAuthProvider {
  private auth: Auth.OAuth2Client;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost";

    if (!clientId || !clientSecret) {
      throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
    }

    this.auth = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new Error("GOOGLE_REFRESH_TOKEN must be set");
    }

    // Set credentials with refresh token
    this.auth.setCredentials({
      refresh_token: refreshToken,
    });

    // Configure auto-refresh on token expiry
    this.auth.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;
      }
    });
  }

  getAuth(): Auth.OAuth2Client {
    return this.auth;
  }

  /**
   * Ensures the auth client has a valid access token
   * Useful to call before making API requests
   */
  async ensureValidToken(): Promise<void> {
    try {
      await this.auth.getAccessToken();
    } catch (error) {
      throw new Error(`Failed to refresh access token: ${error}`);
    }
  }
}
