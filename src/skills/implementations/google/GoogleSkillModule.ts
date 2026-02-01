import { GoogleAuthProvider } from "./auth/GoogleAuthProvider";
import { GoogleCalendarClient } from "./clients/GoogleCalendarClient";
import { GoogleGmailClient } from "./clients/GoogleGmailClient";
// import { GoogleAgendaSkill } from "./skills/GoogleAgendaSkill";
import { GoogleGmailSkill } from "./skills/GoogleGmailSkill";

export class GoogleSkillModule {
  static init() {
    const authProvider = new GoogleAuthProvider();

    // const calendarClient = new GoogleCalendarClient(authProvider);
    const gmailClient = new GoogleGmailClient(authProvider);

    return [
    //   new GoogleAgendaSkill(calendarClient),
      new GoogleGmailSkill(gmailClient)
    ];
  }
}
