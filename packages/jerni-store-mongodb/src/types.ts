import type { Store } from "@jerni/jerni-3/types";
import type {
  Collection,
  DeleteManyModel,
  DeleteOneModel,
  Document,
  InsertOneModel,
  UpdateFilter,
  UpdateOneModel,
} from "mongodb";
import type MongoDBModel from "./model";

export interface Changes {
  added: number;
  updated: number;
  deleted: number;
}

// biome-ignore lint/suspicious/noExplicitAny: this can be any collection, however, if using Document, it will cause Typescript constraint error
export interface MongoDBStoreConfig<Models extends MongoDBModel<any>[]> {
  name: string;
  dbName: string;
  url: string;

  models: Models;

  logger?: Logger;
}

interface Logger {
  debug: Console["debug"];
  log: Console["log"];
  info: Console["info"];
  warn: Console["warn"];
  error: Console["error"];
}

export interface TransformFn<DocumentType extends Document> {
  (event: JourneyCommittedEvent): MongoOps<DocumentType>[] | undefined;
  meta?: StoreMeta;
}

export interface StoreMeta {
  includes: string[];
}

// biome-ignore lint/suspicious/noExplicitAny: this can be any collection, however, if using Document, it will cause Typescript constraint error
export interface MongoDBStore<MongoReaderTuple extends [MongoDBModel<any>, Collection<any>]>
  extends Store<MongoReaderTuple> {}

// biome-ignore lint/suspicious/noExplicitAny: This type is only determined when integrate with jerni and it should not affect the type safety of the store
type JerniDeterminedType = any;

export interface JourneyCommittedEvent {
  id: number;
  type: JerniDeterminedType;
  payload: JerniDeterminedType;
}

export interface InsertOneOp<DocumentType extends Document> {
  insertOne: InsertOneModel<DocumentType>["document"];
}

export interface InsertManyOp<DocumentType extends Document> {
  insertMany: InsertOneModel<DocumentType>["document"][];
}

export interface UpdateOneOp<DocumentType extends Document> {
  updateOne:
    | {
        where: UpdateOneModel<DocumentType>["filter"];
        changes: UpdateFilter<DocumentType>;
        arrayFilters?: UpdateOneModel<DocumentType>["arrayFilters"];
      }
    | {
        where: UpdateOneModel<DocumentType>["filter"];
        pipeline: UpdateFilter<DocumentType>[];
        arrayFilters?: UpdateOneModel<DocumentType>["arrayFilters"];
      };
}

export interface UpdateManyOp<DocumentType extends Document> {
  updateMany:
    | {
        where: UpdateOneModel<DocumentType>["filter"];
        changes: UpdateFilter<DocumentType>;
        arrayFilters?: UpdateOneModel<DocumentType>["arrayFilters"];
      }
    | {
        where: UpdateOneModel<DocumentType>["filter"];
        pipeline: UpdateFilter<DocumentType>[];
        arrayFilters?: UpdateOneModel<DocumentType>["arrayFilters"];
      };
}

export interface DeleteOneOp<DocumentType extends Document> {
  deleteOne: {
    where: DeleteOneModel<DocumentType>["filter"];
  };
}

export interface DeleteManyOp<DocumentType extends Document> {
  deleteMany: {
    where: DeleteManyModel<DocumentType>["filter"];
  };
}

export type MongoOps<DocumentType extends Document> =
  | InsertOneOp<DocumentType>
  | InsertManyOp<DocumentType>
  | UpdateOneOp<DocumentType>
  | UpdateManyOp<DocumentType>
  | DeleteOneOp<DocumentType>
  | DeleteManyOp<DocumentType>;
