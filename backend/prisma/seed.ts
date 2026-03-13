import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seedUsers = [
    {
      email: "alice@chmsu.edu.ph",
      name: "Alice",
      picture: "https://picsum.photos/seed/alice/200",
    },
    {
      email: "bob@chmsu.edu.ph",
      name: "Bob",
      picture: "https://picsum.photos/seed/bob/200",
    },
  ];

  for (const user of seedUsers) {
    try {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          picture: user.picture,
          avatarUrl: user.picture,
        },
        create: {
          email: user.email,
          name: user.name,
          picture: user.picture,
          avatarUrl: user.picture,
        },
      });
    } catch (err: any) {
      // If the avatarUrl column doesn't exist (Prisma P2022), retry without avatarUrl
      if (err?.code === "P2022" && err?.meta?.column === "avatarUrl") {
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name, picture: user.picture },
          create: { email: user.email, name: user.name, picture: user.picture },
        });
      } else {
        throw err;
      }
    }
  }

  // Attempt to backfill avatarUrl where missing. If the column isn't present, skip this step.
  let backfilled = 0;
  try {
    const needsAvatar = await prisma.user.findMany({
      where: {
        avatarUrl: null,
        NOT: { picture: null },
      },
      select: { id: true, picture: true },
    });

    for (const user of needsAvatar) {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: user.picture },
      });
    }
    backfilled = needsAvatar.length;
    // console.log(`Backfilled ${backfilled} avatar(s)`);
  } catch (err: any) {
    if (err?.code === "P2022" && err?.meta?.column === "avatarUrl") {
      // console.log('avatarUrl column missing, skipping backfill step');
    } else {
      throw err;
    }
  }

  // console.log(`Seeded users (${seedUsers.length}) and backfilled ${backfilled} avatar(s)`);

  // ── Knowledge Base seed articles ──────────────────────────────
  const kbArticles = [
    {
      title: "How to Connect to Campus Wi-Fi",
      content: `## Steps to Connect\n\n1. Open your device's Wi-Fi settings.\n2. Select the **CHMSU-WiFi** network.\n3. Enter your institutional email and password when prompted.\n4. Accept the certificate if asked.\n\n## Troubleshooting\n- **Cannot see the network:** Move closer to an access point or restart your Wi-Fi adapter.\n- **Authentication failed:** Reset your password at the ICT Help Desk.\n- **Slow connection:** The network may be congested during peak hours. Try again later.`,
      category: "NETWORK",
      tags: "wifi,internet,connection,network,campus",
      status: "PUBLISHED" as const,
    },
    {
      title: "Requesting a New Software Installation",
      content: `## Process\n\n1. Submit a **MIS Ticket** with category **SOFTWARE**.\n2. Select **Install Existing Software** or **New Information System** as applicable.\n3. Provide the software name, version, and purpose in the description.\n4. The MIS team will review your request and schedule the installation.\n\n## Important Notes\n- Only licensed or open-source software can be installed.\n- Allow 2-3 business days for processing.\n- For urgent needs, mark the ticket as **HIGH** priority.`,
      category: "SOFTWARE",
      tags: "software,install,application,request",
      status: "PUBLISHED" as const,
    },
    {
      title: "Printer Not Working — Common Fixes",
      content: `## Quick Checks\n\n1. **Is it plugged in?** Verify the power cable and USB/network cable.\n2. **Paper jam:** Open the printer tray and remove stuck paper.\n3. **Out of toner/ink:** Check the ink levels in printer settings.\n4. **Driver issue:** Reinstall the printer driver from the manufacturer's website.\n\n## When to Submit a Ticket\nIf the above steps don't resolve your issue, submit an **ITS Ticket** and select **Printer** under Maintenance.`,
      category: "HARDWARE",
      tags: "printer,hardware,paper jam,toner,not working",
      status: "PUBLISHED" as const,
    },
    {
      title: "How to Reset Your Account Password",
      content: `## For Institutional Email\n\n1. Go to the password reset portal.\n2. Enter your email address.\n3. Follow the verification steps sent to your recovery email.\n\n## For ICT System Account\n\n1. Contact the ICT Help Desk or your department admin.\n2. Provide your full name and employee/student ID.\n3. A temporary password will be issued.\n\n## Tips\n- Use a strong password (8+ characters, mixed case, numbers, symbols).\n- Do not reuse passwords across systems.`,
      category: "ACCOUNT",
      tags: "password,reset,account,login,access",
      status: "PUBLISHED" as const,
    },
    {
      title: "Desktop/Laptop Running Slow — Optimization Guide",
      content: `## Steps to Speed Up Your Computer\n\n1. **Restart your computer** — this clears temporary files and refreshes memory.\n2. **Close unused applications** — check Task Manager (Ctrl+Shift+Esc) for high CPU/memory usage.\n3. **Run Disk Cleanup** — search for "Disk Cleanup" in the Start menu.\n4. **Check for malware** — run a full antivirus scan.\n5. **Update your system** — install pending Windows updates.\n\n## When to Request Service\nIf performance doesn't improve, submit an **ITS Ticket** selecting **Desktop/Laptop → Checkup**.`,
      category: "HARDWARE",
      tags: "slow,performance,desktop,laptop,optimization,cleanup",
      status: "PUBLISHED" as const,
    },
    {
      title: "Submitting a Service Request — Step by Step",
      content: `## How to Submit a Ticket\n\n1. Log in to the ICT Service Request System.\n2. Click **New Ticket** in the sidebar.\n3. Select your ticket type:\n   - **MIS** — for software, website, or information system requests.\n   - **ITS** — for hardware maintenance, network issues, or equipment borrowing.\n4. Fill in the required details and check the applicable categories.\n5. Click **Submit**.\n\n## After Submission\n- Your ticket goes to the **Secretary** for initial review.\n- Then to the **Director** for approval.\n- Finally, it is assigned to the appropriate technical staff.\n- You can track progress on the **My Tickets** page.`,
      category: "GENERAL",
      tags: "ticket,submit,request,how to,guide,new",
      status: "PUBLISHED" as const,
    },
  ];

  // Find an admin user to attribute articles to
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const authorId = adminUser?.id || 1;

  for (const article of kbArticles) {
    const existing = await prisma.knowledgeArticle.findFirst({
      where: { title: article.title },
    });
    if (!existing) {
      await prisma.knowledgeArticle.create({
        data: { ...article, createdById: authorId },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    // Re-throw so the process exits with a failure code after disconnecting
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
