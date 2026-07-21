const CLOUDINARY_CLOUD_NAME = 'x4aregua';
const CLOUDINARY_UPLOAD_PRESET = 'mdconf_chat_unsigned';

// Cloudinary разделяет эндпоинты по типу ресурса: image/upload для фото,
// video/upload для видео И аудио (Cloudinary трактует аудио как video
// resource_type — так исторически устроено их API).
function resolveResourceType(kind: 'image' | 'video' | 'audio'): 'image' | 'video' {
  return kind === 'image' ? 'image' : 'video';
}

/**
 * Загружает файл напрямую с браузера на Cloudinary (минуя наш backend
 * полностью) и возвращает публичный URL готового файла. Используется вместо
 * прежнего fileToBase64 + отправки как JSON — тяжёлые файлы больше не идут
 * через Render как base64, а грузятся прямо на CDN Cloudinary.
 */
export async function uploadToCloudinary(
  file: Blob,
  kind: 'image' | 'video' | 'audio',
  filename?: string
): Promise<string> {
  const resourceType = resolveResourceType(kind);
  const formData = new FormData();
  formData.append('file', file, filename);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error?.message || 'Не удалось загрузить файл в Cloudinary');
  }

  const data = await res.json();
  return data.secure_url as string;
}