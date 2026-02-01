import { google, calendar_v3 } from "googleapis";
import { GoogleAuthProvider } from "../auth/GoogleAuthProvider";

export class GoogleCalendarClient {
  private calendar: calendar_v3.Calendar;

  constructor(authProvider: GoogleAuthProvider) {
    this.calendar = google.calendar({
      version: "v3",
      auth: authProvider.getAuth(),
    });
  }

  listEvents(max = 10) {
    return this.calendar.events.list({
      calendarId: "primary",
      maxResults: max,
    });
  }
}
