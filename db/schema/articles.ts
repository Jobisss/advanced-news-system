import {
    index,
    integer,
    pgTable,
    real,
    text,
    timestamp,
    unique,
    uuid,
} from 'drizzle-orm/pg-core';
import { sources } from './sources';
import { articleRawStatusEnum } from './enums';

export const articlesRaw = pgTable(
    'articles_raw',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        sourceId: uuid('source_id')
            .notNull()
            .references(() => sources.id, { onDelete: 'cascade' }),
        urlCanonical: text('url_canonical'),
        urlHash: text('url_hash').notNull(),
        contentHash: text('content_hash'),
        // httpStatus: integer('http_status'),
        fetchedAt: timestamp('fetched_at', { withTimezone: true }),
        publishedAt: timestamp('published_at', { withTimezone: true }),
        title: text('title'),
        author: text('author'),
        language: text('language'),
        mainImageUrl: text('main_image_url'),
        status: articleRawStatusEnum('status').notNull().default('discovered'),
        error: text('error'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        unique().on(table.urlHash),
        unique().on(table.contentHash),
        index('idx_articles_raw_source').on(table.sourceId),
        index('idx_articles_raw_status').on(table.status),
        index('idx_articles_raw_published_at').on(table.publishedAt),
        index('idx_articles_raw_url_canonical').on(table.urlCanonical),
    ]
);

export const articleEmbeddings = pgTable(
    'article_embeddings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        articleRawId: uuid('article_raw_id')
            .notNull()
            .references(() => articlesRaw.id, { onDelete: 'cascade' }),
        embeddingModel: text('embedding_model')
            .notNull()
            .default('text-embedding-3-small'),
        embeddingVector: real('embedding_vector').array().notNull(),
        embeddingDimensions: integer('embedding_dimensions')
            .notNull()
            .default(1536),
        textInput: text('text_input').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (table) => [
        unique().on(table.articleRawId, table.embeddingModel),
        index('idx_article_embeddings_article_raw').on(table.articleRawId),
    ]
);

export const rewritedArticles = pgTable(
    'rewrited_articles',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        articleRawId: uuid('article_raw_id')
            .notNull()
            .references(() => articlesRaw.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        author: text('author'),
        content: text('content').notNull(),
        summary: text('summary'),
        language: text('language').notNull().default('pt-BR'),
        generatedImageUrl: text('generated_image_url'),
        publishedAt: timestamp('published_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        unique().on(table.articleRawId),
        index('idx_articles_canonical_published_at').on(table.publishedAt),
    ]
);