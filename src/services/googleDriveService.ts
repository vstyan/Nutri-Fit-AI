/**
 * Google Drive REST API integration for sync and storage.
 * Creates and reads files within a dedicated "Diet-Exercise-PWA" folder.
 */

const FOLDER_NAME = 'Diet-Exercise-PWA';
let cachedFolderId: string | null = null;

export async function getOrCreateAppFolder(accessToken: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  // Search if folder exists
  const query = `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    throw new Error(`Google Drive folder search failed: ${searchRes.statusText}`);
  }

  const data = await searchRes.json();
  if (data.files && data.files.length > 0) {
    cachedFolderId = data.files[0].id;
    return cachedFolderId!;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create Google Drive folder: ${createRes.statusText}`);
  }

  const createData = await createRes.json();
  cachedFolderId = createData.id;
  return cachedFolderId!;
}

export async function saveJsonToDrive(
  fileName: string,
  data: any,
  accessToken: string
): Promise<string> {
  const folderId = await getOrCreateAppFolder(accessToken);
  const jsonContent = JSON.stringify(data, null, 2);

  // Check if file already exists in folder
  const query = `name = '${fileName}' and '${folderId}' in parents and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const searchData = await searchRes.json();
  const existingFileId = searchData.files?.[0]?.id;

  if (existingFileId) {
    // Update existing file content
    const updateRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: jsonContent
      }
    );
    if (!updateRes.ok) {
      throw new Error(`Failed to update file in Google Drive: ${updateRes.statusText}`);
    }
    return existingFileId;
  } else {
    // Create new file via multipart upload
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json'
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonContent +
      closeDelimiter;

    const createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      }
    );

    if (!createRes.ok) {
      throw new Error(`Failed to save file to Google Drive: ${createRes.statusText}`);
    }

    const created = await createRes.json();
    return created.id;
  }
}

export async function readJsonFromDrive<T>(
  fileName: string,
  accessToken: string
): Promise<T | null> {
  const folderId = await getOrCreateAppFolder(accessToken);
  const query = `name = '${fileName}' and '${folderId}' in parents and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!searchRes.ok) return null;

  const searchData = await searchRes.json();
  const fileId = searchData.files?.[0]?.id;
  if (!fileId) return null;

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const downloadRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!downloadRes.ok) return null;
  return (await downloadRes.json()) as T;
}
