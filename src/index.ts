import { config } from "dotenv";
import { TelegramBot } from "./telegram_bot/telegram_bot";
import { GoogleSkillModule } from "@skills/implementations/google/GoogleSkillModule";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
    console.log("J.A.R.V.I.S is starting...");

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error("TELEGRAM_BOT_TOKEN is not defined in .env or .env.local");
        process.exit(1);
    }

    const telegramBot = new TelegramBot(botToken);
    telegramBot.launch();
}

main();