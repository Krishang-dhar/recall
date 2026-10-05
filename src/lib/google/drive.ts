import { google } from 'googleapis';
import { getAuthenticatedOAuthClient } from './oauth';
import { addAction } from '../action-history';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconType: 'pdf' | 'doc' | 'sheet' | 'folder' | 'file';
  size?: string;
}

export async function searchDriveFiles(query: string = '', pageSize = 8): Promise<{
  connected: boolean;
  needsScope?: boolean;
  files: DriveFileItem[];
  error?: string;
}> {
  const auth = await getAuthenticatedOAuthClient();
  if (!auth) {
    return {
      connected: false,
      files: [],
      error: 'Connect Google account to search Drive files.',
    };
  }

  try {
    const drive = google.drive({ version: 'v3', auth });
    const q = query ? `name contains '${query}' and trashed = false` : 'trashed = false';

    const response = await drive.files.list({
      pageSize,
      q,
      fields: 'files(id, name, mimeType, modifiedTime, webViewLink, size)',
      orderBy: 'modifiedTime desc',
    });

    const items = (response.data.files || []).map((f) => ({
      id: f.id || `file-${Date.now()}`,
      name: f.name || 'Untitled File',
      mimeType: f.mimeType || 'application/octet-stream',
      modifiedTime: f.modifiedTime || new Date().toISOString(),
      webViewLink: f.webViewLink || 'https://drive.google.com',
      iconType: determineIconType(f.mimeType || '', f.name || ''),
      size: f.size ? formatFileSize(parseInt(f.size, 10)) : undefined,
    }));

    return {
      connected: true,
      files: items,
    };
  } catch (err: any) {
    const msg = err.message || '';
    const needsScope =
      msg.includes('insufficient authentication scopes') ||
      msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT');

    console.warn('Google Drive search warning:', msg);

    return {
      connected: true,
      needsScope,
      files: [],
      error: needsScope
        ? 'Drive read scope (https://www.googleapis.com/auth/drive.readonly) requires re-authorization.'
        : msg,
    };
  }
}

function determineIconType(
  mime: string,
  name: string
): 'pdf' | 'doc' | 'sheet' | 'folder' | 'file' {
  if (mime.includes('folder')) return 'folder';
  if (mime.includes('pdf') || name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (
    mime.includes('document') ||
    mime.includes('word') ||
    name.toLowerCase().endsWith('.docx')
  )
    return 'doc';
  if (
    mime.includes('spreadsheet') ||
    mime.includes('sheet') ||
    name.toLowerCase().endsWith('.xlsx')
  )
    return 'sheet';
  return 'file';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Drive management functions ───────────────────────────────────────────────

export async function trashDriveFile(
  fileId: string,
  fileName?: string,
  mimeType?: string
): Promise<{ success: boolean; actionId?: string; needsScope?: boolean; error?: string }> {
  const auth = await getAuthenticatedOAuthClient();
  if (!auth) return { success: false, error: 'Google account not connected.' };

  try {
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.update({
      fileId,
      requestBody: { trashed: true },
    });

    const action = addAction({
      tool: 'drive',
      action: 'trash_drive_file',
      label: `Moved${fileName ? ` "${fileName}"` : ' file'} to Drive Trash`,
      status: 'completed',
      targetIds: [fileId],
      beforeState: {
        type: 'drive_file',
        file: { id: fileId, name: fileName || 'Unknown file', mimeType: mimeType || '', trashed: false },
      },
      undoable: 'provider_reversible',
    });

    return { success: true, actionId: action.id };
  } catch (err: any) {
    const msg = err.message || '';
    if (
      msg.includes('insufficient authentication scopes') ||
      msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
    ) {
      return { success: false, needsScope: true, error: 'Drive write scope required to trash files.' };
    }
    return { success: false, error: msg };
  }
}

export async function restoreDriveFile(
  fileId: string
): Promise<{ success: boolean; needsScope?: boolean; error?: string }> {
  const auth = await getAuthenticatedOAuthClient();
  if (!auth) return { success: false, error: 'Google account not connected.' };

  try {
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.update({
      fileId,
      requestBody: { trashed: false },
    });
    return { success: true };
  } catch (err: any) {
    const msg = err.message || '';
    return { success: false, error: msg };
  }
}
