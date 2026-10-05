import { google } from 'googleapis';
import { getAuthenticatedOAuthClient } from './oauth';
import { EmailFollowUpSuggestion } from '../types';
import { addAction } from '../action-history';

export async function searchEmails(query: string = 'category:primary', maxResults = 8) {
  const auth = await getAuthenticatedOAuthClient();
  if (!auth) {
    return {
      connected: false,
      error: 'Connect Gmail to let Recall check your inbox.',
      emails: [],
    };
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0) {
      // If primary query has no items, try a broader query
      const broadRes = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
      });
      messages.push(...(broadRes.data.messages || []));
    }

    const emails: EmailFollowUpSuggestion[] = [];

    for (const msg of messages.slice(0, maxResults)) {
      if (!msg.id) continue;
      try {
        const details = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = details.data.payload?.headers || [];
        const fromHeader =
          headers.find((h) => h.name?.toLowerCase() === 'from')?.value || 'Unknown';
        const subjectHeader =
          headers.find((h) => h.name?.toLowerCase() === 'subject')?.value || '(No subject)';
        const dateHeader =
          headers.find((h) => h.name?.toLowerCase() === 'date')?.value || '';

        // Format sender name cleanly
        const cleanSender = fromHeader.replace(/<.*>/, '').replace(/"/g, '').trim() || fromHeader;

        emails.push({
          id: msg.id,
          sender: cleanSender,
          subject: subjectHeader,
          date: dateHeader,
          snippet: details.data.snippet || '',
          relativeTime: formatRelativeTime(dateHeader),
        });
      } catch (e) {}
    }

    return {
      connected: true,
      emails,
    };
  } catch (err: any) {
    console.warn('Gmail query warning:', err.message);
    return {
      connected: true,
      error: err.message || 'Error accessing Gmail',
      emails: [],
    };
  }
}

export async function findPotentialFollowUps(): Promise<{
  connected: boolean;
  error?: string;
  suggestions: EmailFollowUpSuggestion[];
}> {
  const result = await searchEmails('category:primary', 6);
  return {
    connected: result.connected,
    error: result.error,
    suggestions: result.emails,
  };
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  body: string;
}): Promise<{
  success: boolean;
  messageId?: string;
  needsScope?: boolean;
  error?: string;
}> {
  const auth = await getAuthenticatedOAuthClient();
  if (!auth) {
    return {
      success: false,
      error: 'Google account is not connected. Connect in Settings or /connections.',
    };
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const utf8Subject = `=?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`;
    const messageParts = [
      `To: ${options.to}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      options.body,
    ];
    const message = messageParts.join('\r\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    return {
      success: true,
      messageId: res.data.id || undefined,
    };
  } catch (err: any) {
    const msg = err.message || '';
    if (
      msg.includes('insufficient authentication scopes') ||
      msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
    ) {
      return {
        success: false,
        needsScope: true,
        error:
          'Gmail send permission (https://www.googleapis.com/auth/gmail.send) is required to dispatch real emails. Re-connect Google to grant sending scope.',
      };
    }
    return {
      success: false,
      error: msg || 'Failed to send email',
    };
  }
}


function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return 'Recently';
  const d = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

// ─── Gmail management functions ───────────────────────────────────────────────

async function modifyEmailLabels(
  messageId: string,
  addLabels: string[],
  removeLabels: string[]
): Promise<{ success: boolean; needsScope?: boolean; error?: string }> {
  const auth = await getAuthenticatedOAuthClient();
  if (!auth) {
    return { success: false, error: 'Google account not connected.' };
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: addLabels,
        removeLabelIds: removeLabels,
      },
    });
    return { success: true };
  } catch (err: any) {
    const msg = err.message || '';
    if (
      msg.includes('insufficient authentication scopes') ||
      msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
    ) {
      return {
        success: false,
        needsScope: true,
        error: 'Recall needs Gmail modify permission to manage emails. Re-connect Google to grant access.',
      };
    }
    return { success: false, error: msg };
  }
}

export async function archiveEmail(
  messageId: string,
  subject?: string
): Promise<{ success: boolean; actionId?: string; needsScope?: boolean; error?: string }> {
  // Archive = remove INBOX label
  const result = await modifyEmailLabels(messageId, [], ['INBOX']);
  if (!result.success) return result;

  const action = addAction({
    tool: 'gmail',
    action: 'archive_email',
    label: `Archived${subject ? ` "${subject}"` : ' email'}`,
    status: 'completed',
    targetIds: [messageId],
    beforeState: { type: 'gmail_message', message: { id: messageId, labelIds: ['INBOX'], subject } },
    undoable: 'provider_reversible',
  });

  return { success: true, actionId: action.id };
}

export async function trashEmail(
  messageId: string,
  subject?: string
): Promise<{ success: boolean; actionId?: string; needsScope?: boolean; error?: string }> {
  const auth = await getAuthenticatedOAuthClient();
  if (!auth) return { success: false, error: 'Google account not connected.' };

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.messages.trash({ userId: 'me', id: messageId });

    const action = addAction({
      tool: 'gmail',
      action: 'trash_email',
      label: `Moved${subject ? ` "${subject}"` : ' email'} to Trash`,
      status: 'completed',
      targetIds: [messageId],
      beforeState: { type: 'gmail_message', message: { id: messageId, subject } },
      undoable: 'provider_reversible',
    });

    return { success: true, actionId: action.id };
  } catch (err: any) {
    const msg = err.message || '';
    if (msg.includes('insufficient authentication scopes') || msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
      return { success: false, needsScope: true, error: 'Gmail manage scope required.' };
    }
    return { success: false, error: msg };
  }
}

export async function untrashEmail(
  messageId: string
): Promise<{ success: boolean; needsScope?: boolean; error?: string }> {
  const auth = await getAuthenticatedOAuthClient();
  if (!auth) return { success: false, error: 'Google account not connected.' };

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    await gmail.users.messages.untrash({ userId: 'me', id: messageId });
    return { success: true };
  } catch (err: any) {
    const msg = err.message || '';
    return { success: false, error: msg };
  }
}

export async function unarchiveEmail(
  messageId: string
): Promise<{ success: boolean; needsScope?: boolean; error?: string }> {
  // Unarchive = add INBOX label back
  return modifyEmailLabels(messageId, ['INBOX'], []);
}

export async function markEmailRead(
  messageId: string,
  read: boolean,
  subject?: string
): Promise<{ success: boolean; actionId?: string; needsScope?: boolean; error?: string }> {
  const result = read
    ? await modifyEmailLabels(messageId, [], ['UNREAD'])
    : await modifyEmailLabels(messageId, ['UNREAD'], []);

  if (!result.success) return result;

  const action = addAction({
    tool: 'gmail',
    action: read ? 'mark_email_read' : 'mark_email_unread',
    label: `Marked${subject ? ` "${subject}"` : ' email'} as ${read ? 'read' : 'unread'}`,
    status: 'completed',
    targetIds: [messageId],
    beforeState: {
      type: 'gmail_message',
      message: { id: messageId, labelIds: read ? ['UNREAD'] : [], subject },
    },
    undoable: 'provider_reversible',
  });

  return { success: true, actionId: action.id };
}
