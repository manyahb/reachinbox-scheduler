import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";

dotenv.config();

export const ES_INDEX = "emails";

const client = new Client({
  node: process.env.ELASTICSEARCH_NODE || "http://localhost:9200",
});

export async function ensureEmailIndex(): Promise<void> {
  const exists = await client.indices.exists({ index: ES_INDEX });
  if (!exists) {
    await client.indices.create({
      index: ES_INDEX,
      mappings: {
        properties: {
          id: { type: "integer" },
          senderEmail: { type: "keyword" },
          recipientEmail: { type: "keyword" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledTime: { type: "date" },
          sentAt: { type: "date" },
        },
      },
    });
    console.log(`✅ Created Elasticsearch index "${ES_INDEX}"`);
  }
}

export interface IndexableEmail {
  id: number;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledTime: string;
  sentAt?: string | null;
}

/** Indexes (or re-indexes) a single email. Safe to call on every status change. */
export async function indexEmail(email: IndexableEmail): Promise<void> {
  try {
    await client.index({
      index: ES_INDEX,
      id: String(email.id),
      document: email,
    });
  } catch (err) {
    // Search is a secondary concern — never let an ES hiccup fail the send/schedule path.
    console.error("Elasticsearch indexing failed:", err);
  }
}

export async function searchEmails(query: string) {
  const result = await client.search({
    index: ES_INDEX,
    query: {
      multi_match: {
        query,
        fields: ["subject", "body", "senderEmail", "recipientEmail"],
        fuzziness: "AUTO",
      },
    },
  });
  return result.hits.hits.map((hit) => hit._source);
}
