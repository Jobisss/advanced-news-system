import { pgEnum } from 'drizzle-orm/pg-core';

export const articleRawStatusEnum = pgEnum('article_raw_status', [
    'discovered',
    'fetched',
    'parsed',
    'deduped',
    'discarded',
    'ready_for_rewrite',
]);
