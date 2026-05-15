import { notFound } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import PostForm from '@/components/admin/PostForm';
import DeletePostButton from '@/components/admin/DeletePostButton';
import { getPostById } from '@/lib/admin-queries';
import { getImageById } from '@/lib/db';
import { getImageUrl } from '@/lib/images';

/**
 * Shape passed to {@link PostForm} for the existing-image preview.
 * `null` when the post has no `image_id` or the row was orphaned.
 */
type CurrentImage = { id: string; signedUrl: string; altText: string } | null;

/**
 * Resolve the post's `image_id` to a signed-URL preview payload.
 *
 * CONSTRAINT-15: reads go through `getImageUrl` (signed URL, TTL 3600s) —
 * the `images` bucket is private and `getPublicUrl` would return 404.
 * Throws bubble loudly per the admin-loud carve-out from CONSTRAINT-14.
 */
async function loadCurrentImage(imageId: string | null): Promise<CurrentImage> {
  if (imageId === null) return null;
  const record = await getImageById(imageId);
  if (record === null) return null;
  const signedUrl = await getImageUrl(record.bucket_path);
  return { id: record.id, signedUrl, altText: record.alt_text };
}

/**
 * Admin "edit post" page (`/admin/posts/[id]`).
 *
 * Server component. Awaits the dynamic `params`, fetches the row via
 * {@link getPostById}, and renders {@link PostForm} prefilled with it.
 * A missing row dispatches Next 15's `notFound()` — `getPostById` returns
 * `null` for the PGRST116 ("no rows") case, distinct from a true DB error
 * (which still throws and surfaces in the Next error overlay, matching the
 * admin-side intentional loudness documented on the list page).
 *
 * The destructive action lives in a separate {@link DeletePostButton} client
 * component below the form: it owns the confirm modal's open-state and calls
 * the `deletePost` Server Action.
 *
 * Auth is enforced by `middleware.ts` for `/admin/:path*`. CONSTRAINT-14's
 * `safeLoad` discipline is for public pages; the admin operator wants loud
 * failures.
 *
 * @param params The dynamic route params, awaited per Next 15.
 * @returns React element rendering the edit-post screen.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const post = await getPostById(id);
  if (post === null) {
    notFound();
  }
  const currentImage = await loadCurrentImage(post.image_id);
  return (
    <>
      <AdminNav />
      <PostForm post={post} currentImage={currentImage} />
      <section className="px-6 pb-10">
        <DeletePostButton id={post.id} name={post.title} afterDelete="redirect" />
      </section>
    </>
  );
}
