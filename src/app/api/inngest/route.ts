import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { ingestDocument } from "@/inngest/functions";

// Create an API that serves zero-config routing to Inngest
// See: https://www.inngest.com/docs/learn/serving-functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ingestDocument,
  ],
});
