export type Channel = 'web' | 'sms' | 'voice' | 'whatsapp' | 'email';

export interface FormatOptions {
  channel: Channel;
  maxLength?: number;
}

export function formatResponse(content: string, options: FormatOptions): string {
  switch (options.channel) {
    case 'sms':
      return formatSms(content, options.maxLength ?? 160);
    case 'voice':
      return formatVoice(content);
    case 'whatsapp':
      return formatWhatsApp(content);
    case 'email':
      return content; // emails can handle full markdown
    default:
      return content; // web — return as-is
  }
}

function formatSms(content: string, maxLen: number): string {
  // Strip markdown
  let text = content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();

  if (text.length <= maxLen) return text;

  // Split into parts
  const parts: string[] = [];
  while (text.length > 0) {
    if (text.length <= maxLen - 8) {
      parts.push(text);
      break;
    }
    const chunk = text.slice(0, maxLen - 8);
    const lastSpace = chunk.lastIndexOf(' ');
    const splitAt = lastSpace > maxLen * 0.5 ? lastSpace : maxLen - 8;
    parts.push(text.slice(0, splitAt) + ` [${parts.length + 1}/N]`);
    text = text.slice(splitAt).trim();
  }
  // Fix the N placeholder
  return parts.map((p, i) => p.replace('/N]', `/${parts.length}]`)).join('\n---\n');
}

function formatVoice(content: string): string {
  // Convert to SSML
  let text = content
    .replace(/\*\*(.*?)\*\*/g, '<emphasis level="strong">$1</emphasis>')
    .replace(/\*(.*?)\*/g, '<emphasis>$1</emphasis>')
    .replace(/`[^`]+`/g, '') // remove code
    .replace(/https?:\/\/\S+/g, '') // remove URLs
    .replace(/#{1,6}\s/g, '')
    .replace(/\n/g, '<break time="300ms"/>');
  return `<speak>${text}</speak>`;
}

function formatWhatsApp(content: string): string {
  // WhatsApp uses *bold* and _italic_ (different from markdown)
  return content
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/__(.*?)__/g, '_$1_');
}
