import { google, gmail_v1 } from "googleapis";
import { GoogleAuthProvider } from "../auth/GoogleAuthProvider";

export class GoogleGmailClient {
  private gmail: gmail_v1.Gmail;
  private authProvider: GoogleAuthProvider;

  constructor(authProvider: GoogleAuthProvider) {
    this.authProvider = authProvider;
    this.gmail = google.gmail({
      version: "v1",
      auth: authProvider.getAuth(),
    });
  }

  async listMessages(max = 5) {
    try {
      // Ensure valid token before making the request
      await this.authProvider.ensureValidToken();
      
      return this.gmail.users.messages.list({
        userId: "me",
        maxResults: max,
      });
    } catch (error) {
      throw new Error(`Failed to list messages: ${error}`);
    }
  }
}
