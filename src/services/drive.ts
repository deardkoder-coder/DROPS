export interface DriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  description?: string;
}

export interface UploadMetadata {
  senderName?: string;
  comment?: string;
}

/**
 * Searches for a folder with the specified name in user's Drive.
 * If not found, creates a new one.
 */
export async function getOrCreateFolder(
  accessToken: string,
  folderName = 'Презентации'
): Promise<DriveFolder> {
  const safeName = folderName.replace(/'/g, "\\'");
  const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,webViewLink)&pageSize=1`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    throw new Error(`Ошибка поиска папки на Google Диске: ${errorText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0] as DriveFolder;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Папка для презентаций, загруженных через сервис Presentation Drop',
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Не удалось создать папку на Google Диске: ${errorText}`);
  }

  return (await createRes.json()) as DriveFolder;
}

/**
 * Uploads a presentation file to the designated Google Drive folder with progress reporting
 */
export async function uploadPresentation(
  accessToken: string,
  file: File,
  folderId: string,
  metadata: UploadMetadata,
  onProgress?: (percent: number) => void
): Promise<DriveFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const boundary = '-------PresentationDropBoundary' + Math.random().toString(36).substring(2);
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelim = '\r\n--' + boundary + '--';

    const descLines = [
      metadata.senderName ? `Отправитель: ${metadata.senderName.trim()}` : null,
      metadata.comment ? `Комментарий: ${metadata.comment.trim()}` : null,
      `Дата загрузки: ${new Date().toLocaleString('ru-RU')}`,
      `Размер: ${(file.size / (1024 * 1024)).toFixed(2)} МБ`,
    ].filter(Boolean);

    const fileMetadata = {
      name: file.name,
      parents: [folderId],
      description: descLines.join('\n\n'),
      properties: {
        sender: metadata.senderName || '',
        app: 'presentation-uploader',
      },
    };

    const metadataBlob = new Blob([JSON.stringify(fileMetadata)], {
      type: 'application/json; charset=UTF-8',
    });

    const multipartBlob = new Blob([
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      metadataBlob,
      delimiter,
      `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
      file,
      closeDelim,
    ]);

    xhr.open(
      'POST',
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,webViewLink,iconLink,thumbnailLink,description'
    );
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', `multipart/related; boundary=${boundary}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch (e) {
          reject(e);
        }
      } else {
        let msg = xhr.statusText;
        try {
          const errData = JSON.parse(xhr.responseText);
          msg = errData?.error?.message || xhr.responseText;
        } catch {
          msg = xhr.responseText || xhr.statusText;
        }
        reject(new Error(`Ошибка Google Диска: ${msg}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Сетевой сбой при передаче файла на Google Диск'));
    };

    xhr.send(multipartBlob);
  });
}

/**
 * Lists all presentation files in the folder
 */
export async function listFolderFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,mimeType,size,createdTime,webViewLink,iconLink,thumbnailLink,description)&orderBy=createdTime desc&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Не удалось загрузить список файлов: ${errorText}`);
  }

  const data = await res.json();
  return (data.files || []) as DriveFile[];
}

/**
 * Moves a file to trash with confirmation
 */
export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 204) {
    const errText = await res.text();
    throw new Error(`Не удалось удалить файл: ${errText}`);
  }
}
