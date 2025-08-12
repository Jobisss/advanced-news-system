import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sources } from "./sources";

export const sitemapCheckpoints = pgTable('sitemap_checkpoints', {  
  id: uuid('id').primaryKey().defaultRandom(),  
  sourceId: uuid('source_id').notNull().references(() => sources.id, { onDelete: 'cascade' }),  
  sitemapUrl: text('sitemap_url').notNull(),  
  lastSeen: timestamp('last_seen', { withTimezone: true }),  
  lastEtag: text('last_etag'),  
  lastModified: timestamp('last_modified', { withTimezone: true }),  
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),  
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),  
}, (table) => ([
  unique().on(table.sourceId, table.sitemapUrl),  
]));