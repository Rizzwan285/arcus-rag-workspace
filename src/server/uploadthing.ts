import { createUploadthing, type FileRouter } from "uploadthing/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const f = createUploadthing();

/**
 * UploadThing File Router
 * Defines upload endpoints and their middleware/callbacks
 */
export const ourFileRouter = {
  /**
   * PDF Document Uploader
   * - Requires authenticated user
   * - Accepts PDF files up to 32MB
   * - Max 5 files per upload
   */
  pdfUploader: f({ pdf: { maxFileSize: "32MB", maxFileCount: 5 } })
    .middleware(async ({ req }) => {
      const session = await getServerSession(authOptions);

      if (!session?.user?.id) {
        throw new Error("Unauthorized – must be signed in to upload");
      }

      // Metadata returned here is accessible in onUploadComplete
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("Upload complete for user:", metadata.userId);
      console.log("File URL:", file.ufsUrl);

      // Return data to the client callback
      return { uploadedBy: metadata.userId, fileUrl: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
