import { createUploadthing, type FileRouter } from "uploadthing/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/server/db/prisma";
import { inngest } from "@/inngest/client";

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
   * - Triggers document ingestion pipeline on completion
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

      // 1. Create Document record in the database with PENDING status
      const doc = await prisma.document.create({
        data: {
          userId: metadata.userId,
          title: file.name.replace(/\.pdf$/i, ""),
          fileUrl: file.ufsUrl,
          fileType: "pdf",
          status: "PENDING",
        },
      });

      // 2. Trigger the Inngest background job
      // The pipeline will: fetch PDF → parse → chunk → embed → store
      // Status updates: PENDING → PROCESSING → COMPLETED/FAILED
      await inngest.send({
        name: "document/ingest",
        data: {
          documentId: doc.id,
          fileUrl: file.ufsUrl,
        },
      });

      // Return data to the client callback
      return { documentId: doc.id, fileUrl: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
