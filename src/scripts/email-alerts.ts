import { EmailAlertService } from "../services/email-alert.service";

async function main() {
  try {
    await EmailAlertService.checkAndSendEmailAlerts();
    console.log("Email alerts check completed successfully");
  } catch (error) {
    console.error("Error running email alerts:", error);
    process.exit(1);
  }
}

main();
