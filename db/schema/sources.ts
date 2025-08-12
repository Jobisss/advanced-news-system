import {
    boolean,
    integer,
    pgTable,
    text,
    timestamp,
    unique,
    uuid,
} from 'drizzle-orm/pg-core';

export const sources = pgTable(
    'sources',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        baseUrl: text('base_url').notNull(),
        robotsTxtUrl: text('robots_txt_url'),
        sitemapIndexUrl: text('sitemap_index_url'),
        userAgent: text('user_agent').default('advanced-news-system'),
        crawlDelaySeconds: integer('crawl_delay_seconds').default(0),
        isActive: boolean('is_active').notNull().default(true),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [unique().on(table.baseUrl)]
);
