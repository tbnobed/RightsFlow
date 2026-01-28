import { storage } from "./storage";
import { sendContractExpiringNotification, sendRevenueReportDueNotification } from "./sendgrid";

async function sendWeeklyNotifications() {
  console.log("Starting weekly notification job...");
  console.log("Date:", new Date().toISOString());

  try {
    const allUsers = await storage.getAllUsers();
    const admins = allUsers.filter((u: any) => u.role === "Admin" && u.isActive && u.email);

    if (admins.length === 0) {
      console.log("No active admin users found to send notifications to.");
      return;
    }

    console.log(`Found ${admins.length} admin(s) to notify.`);

    const contracts = await storage.getContracts();
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringContracts = contracts.filter(contract => {
      if (!contract.endDate || contract.status !== "Active") return false;
      const endDate = new Date(contract.endDate);
      return endDate >= today && endDate <= thirtyDaysFromNow;
    });

    const contractsWithReporting = contracts.filter(c => 
      c.status === "Active" && c.reportingFrequency && c.reportingFrequency !== "None"
    );

    for (const admin of admins) {
      const recipientName = admin.firstName || "Admin";
      const recipientEmail = admin.email;

      if (expiringContracts.length > 0) {
        console.log(`Sending expiring contracts alert to ${recipientEmail}...`);
        try {
          await sendContractExpiringNotification({
            recipientEmail,
            recipientName,
            contracts: expiringContracts.map(c => {
              const endDate = new Date(c.endDate!);
              const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return {
                partner: c.partner,
                content: c.licensee || "",
                endDate: c.endDate!,
                daysRemaining,
                autoRenewal: c.autoRenew || false,
              };
            }),
          });
          console.log(`Expiring contracts email sent to ${recipientEmail}`);
        } catch (error) {
          console.error(`Failed to send expiring contracts email to ${recipientEmail}:`, error);
        }
      }

      if (contractsWithReporting.length > 0) {
        console.log(`Sending revenue reports reminder to ${recipientEmail}...`);
        try {
          await sendRevenueReportDueNotification({
            recipientEmail,
            recipientName,
            contracts: contractsWithReporting.map(c => ({
              partner: c.partner,
              content: c.licensee || "",
              reportingFrequency: c.reportingFrequency || "Monthly",
              nextReportDue: getNextReportDue(c.reportingFrequency || "Monthly"),
            })),
          });
          console.log(`Revenue reports email sent to ${recipientEmail}`);
        } catch (error) {
          console.error(`Failed to send revenue reports email to ${recipientEmail}:`, error);
        }
      }
    }

    console.log("Weekly notification job completed successfully.");
  } catch (error) {
    console.error("Weekly notification job failed:", error);
    process.exit(1);
  }
}

function getNextReportDue(frequency: string): string {
  const today = new Date();
  switch (frequency) {
    case "Monthly":
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 15);
      return nextMonth.toISOString().split('T')[0];
    case "Quarterly":
      const quarter = Math.floor(today.getMonth() / 3);
      const nextQuarter = new Date(today.getFullYear(), (quarter + 1) * 3, 15);
      return nextQuarter.toISOString().split('T')[0];
    case "Annually":
      const nextYear = new Date(today.getFullYear() + 1, 0, 31);
      return nextYear.toISOString().split('T')[0];
    default:
      return "TBD";
  }
}

sendWeeklyNotifications()
  .then(() => {
    console.log("Job finished.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
