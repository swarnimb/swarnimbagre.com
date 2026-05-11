import { getImageById } from '@/lib/db';
import { getImageUrl } from '@/lib/images';

interface PostImageProps {
  imageId?: string;
  alt: string;
}

/**
 * Server-rendered image for post content. Resolves imageId to a signed
 * Storage URL at request time. Renders nothing when imageId is absent or
 * when image lookup/signing fails — failures are logged but do not surface
 * to the visitor (EH-04).
 */
export async function PostImage({ imageId, alt }: PostImageProps) {
  if (!imageId) return null;
  let url: string;
  try {
    const record = await getImageById(imageId);
    if (!record) return null;
    url = await getImageUrl(record.bucket_path);
  } catch (error) {
    console.error('[component] PostImage failed to resolve image', {
      component: 'PostImage',
      imageId,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
  return <img src={url} alt={alt} loading="lazy" />;
}
