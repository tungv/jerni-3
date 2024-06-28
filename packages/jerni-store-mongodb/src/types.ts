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

export interface MongoDBStoreConfig {
  name: string;
  dbName: string;
  url: string;

  // biome-ignore lint/suspicious/noExplicitAny: this can be any collection, however, if using Document, it will cause Typescript constraint error
  models: MongoDBModel<any>[];

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

export interface MongoDBStore {
  name: string;
  meta: StoreMeta;

  /**
   * journey instance will call this method to register models.
   * Registration of a model will tell which store this model belongs to.
   *
   * This is useful when journey.getReader() is called.
   */
  registerModels: (
    map: Map<
      {
        name: string;
        version: string;
      },
      MongoDBStore
    >,
  ) => void;

  getDriver<T extends Document>(model: MongoDBModel<T>): Collection<T>;
  handleEvents: (events: JourneyCommittedEvent[]) => Promise<{ [modelIdentifier: string]: Changes }>;
  getLastSeenId: () => Promise<number>;
  toString(): string;

  listen: () => AsyncGenerator<number, void, unknown>;
  clean: () => Promise<void>;
  dispose: () => Promise<void>;
}

export interface JourneyCommittedEvent {
  id: number;
  type: string;
  payload: unknown;
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
