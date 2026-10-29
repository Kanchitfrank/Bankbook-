import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const bankbookDocuments = sqliteTable('bankbook_documents', {
 userId: text('user_id').primaryKey(),
 revision: integer('revision').notNull(),
 document: text('document').notNull(),
 updatedAt: text('updated_at').notNull(),
 lastMutation: text('last_mutation').notNull(),
});
export const bankbookDocumentChunks=sqliteTable('bankbook_document_chunks',{
 userId:text('user_id').notNull(),mutationId:text('mutation_id').notNull(),part:integer('part').notNull(),content:text('content').notNull(),
},table=>[primaryKey({columns:[table.userId,table.mutationId,table.part]})]);
