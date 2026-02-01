import { google, gmail_v1 } from "googleapis";
import { GoogleAuthProvider } from "../auth/GoogleAuthProvider";

export class GoogleGmailClient {
  private gmail: gmail_v1.Gmail;

  constructor(authProvider: GoogleAuthProvider) {
    this.gmail = google.gmail({
      version: "v1",
      auth: authProvider.getAuth(),
    });
  }

  listMessages(max = 5) {
    return this.gmail.users.messages.list({
      userId: "me",
      maxResults: max,
    });
  }
}
