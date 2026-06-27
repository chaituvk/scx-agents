// Campaign delivery worker — sends messages to campaign contacts.
// Called by the API when launching a campaign.
// Processes pending contacts in batches, generating personalized messages
// via template substitution or LLM, then dispatches via the appropriate channel adapter.

import { campaignRepo, Campaign } from "../repositories/campaign";
import { sendSms } from "../integrations/adapters/twilio";
import { sendEmail } from "../integrations/adapters/email";
import { chat } from "../llm";

const BATCH_SIZE = 100;

/**
 * Replace {{key}} placeholders in a template string with values from the
 * variables map. Unmatched placeholders are left as-is.
 */
export function personalizeMessage(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match;
  });
}

/**
 * Use the LLM to generate a personalized message for a single contact.
 * Falls back to simple template substitution if the LLM call fails.
 */
async function generateAiMessage(
  template: string,
  contactVars: Record<string, string>
): Promise<string> {
  const contactSummary = Object.entries(contactVars)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const prompt = template
    ? `You are writing a short, personalized outbound message for a customer.\n\nTemplate:\n${template}\n\nContact details: ${contactSummary}\n\nWrite a concise, friendly message tailored to this contact. Keep it under 160 characters if possible. Return only the message text.`
    : `Write a short, friendly personalized outbound message for a contact with these details: ${contactSummary}. Keep it under 160 characters.`;

  try {
    const response = await chat(
      [{ role: "user", content: prompt }],
      "fast"
    );
    return response.content.trim();
  } catch {
    // Fall back to template substitution
    return personalizeMessage(template, contactVars);
  }
}

/**
 * Send the campaign message to a contact via the appropriate channel.
 */
async function dispatchMessage(
  channel: Campaign["channel"],
  contact: { phone?: string; email?: string; name?: string },
  message: string
): Promise<{ ok: boolean; error?: string }> {
  if (channel === "sms" || channel === "whatsapp") {
    if (!contact.phone) {
      return { ok: false, error: "No phone number for contact" };
    }
    const result = await sendSms(contact.phone, message);
    return { ok: result.ok, error: result.error };
  }

  if (channel === "email") {
    if (!contact.email) {
      return { ok: false, error: "No email address for contact" };
    }
    const result = await sendEmail({
      to: contact.email,
      toName: contact.name,
      subject: "Message from us",
      htmlBody: `<p>${message.replace(/\n/g, "<br>")}</p>`,
      textBody: message,
    });
    return { ok: result.success, error: result.error };
  }

  return { ok: false, error: `Unsupported channel: ${channel}` };
}

/**
 * Launch a campaign: mark it running, process all pending contacts in batches,
 * then mark it completed (or failed).
 */
export async function launchCampaign(
  campaignId: string,
  tenantId: string
): Promise<void> {
  const now = new Date().toISOString();

  // Mark the campaign as running
  await campaignRepo.update(campaignId, tenantId, {
    status: "running",
    started_at: now,
  });

  try {
    const campaign = await campaignRepo.findById(campaignId, tenantId);
    if (!campaign) {
      console.error(`[campaign] Campaign ${campaignId} not found`);
      return;
    }

    const template = campaign.message_template ?? "";

    let processedAll = false;
    while (!processedAll) {
      const contacts = await campaignRepo.getPendingContacts(campaignId, BATCH_SIZE);
      if (contacts.length === 0) {
        processedAll = true;
        break;
      }

      for (const contact of contacts) {
        const vars: Record<string, string> = {
          name: contact.name ?? "",
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          ...contact.variables,
        };

        let message: string;
        if (campaign.use_ai_personalization) {
          message = await generateAiMessage(template, vars);
        } else {
          message = personalizeMessage(template, vars);
        }

        const result = await dispatchMessage(campaign.channel, contact, message);
        const sentAt = new Date().toISOString();

        if (result.ok) {
          await campaignRepo.updateContact(contact.id, {
            status: "sent",
            sent_at: sentAt,
          });
          await campaignRepo.updateStats(campaignId, { sent_count: 1 });
        } else {
          await campaignRepo.updateContact(contact.id, {
            status: "failed",
            failed_at: sentAt,
            error: result.error,
          });
          await campaignRepo.updateStats(campaignId, { failed_count: 1 });
        }
      }

      if (contacts.length < BATCH_SIZE) {
        processedAll = true;
      }
    }

    // Mark campaign completed
    await campaignRepo.update(campaignId, tenantId, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    console.log(`[campaign] Campaign ${campaignId} completed`);
  } catch (err) {
    console.error(`[campaign] Campaign ${campaignId} failed:`, err);
    await campaignRepo.update(campaignId, tenantId, {
      status: "failed",
    });
  }
}
