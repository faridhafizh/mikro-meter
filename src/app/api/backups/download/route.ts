import fs from 'fs';
import path from 'path';
import { getBackupDirectory } from '@/lib/dataStore';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return new Response('Missing filename query parameter', { status: 400 });
    }

    // Security: sanitize filename to prevent directory traversal attacks
    const safeFilename = path.basename(filename);
    const filePath = path.join(getBackupDirectory(), safeFilename);

    if (!fs.existsSync(filePath)) {
      return new Response('Backup file not found on server storage', { status: 404 });
    }

    const fileStream = fs.readFileSync(filePath);

    return new Response(fileStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(`Download error: ${errorMessage}`, { status: 500 });
  }
}
