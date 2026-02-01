import { google, Auth } from "googleapis";
import fs from "fs";

export class GoogleAuthProvider {
  private auth: Auth.OAuth2Client;

  constructor() {
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.loadToken();
  }

  private loadToken() {
    if (!fs.existsSync("google-token.json")) {
      throw new Error("Google token missing");
    }

    const token = JSON.parse(fs.readFileSync("google-token.json", "utf-8"));
    this.auth.setCredentials(token);
  }

  getAuth(): Auth.OAuth2Client {
    return this.auth;
  }
}
