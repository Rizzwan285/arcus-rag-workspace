/**
 * UploadThing React Hooks
 *
 * Generated client-side hooks for the UploadThing file router.
 * Provides type-safe upload hooks bound to our file router endpoints.
 */

import {
  generateUploadButton,
  generateUploadDropzone,
  generateReactHelpers,
} from "@uploadthing/react";
import type { OurFileRouter } from "@/server/uploadthing";

export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
