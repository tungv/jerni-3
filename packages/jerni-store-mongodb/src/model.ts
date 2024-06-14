import type { Document } from "mongodb";
import type { StoreMeta, TransformFn } from "./types";

export default class MongoDBModel<DocumentType extends Document> {
  name: string;
  version: string;
  transform: TransformFn<DocumentType>;
  meta?: StoreMeta;
  // biome-ignore lint/suspicious/noExplicitAny: no need to care about the document type of dependencies
  dependencies?: Array<MongoDBModel<any>>;

  constructor({
    name,
    version,
    transform,
    meta,
    dependencies,
  }: {
    name: string;
    version: string;
    transform: TransformFn<DocumentType>;
    meta?: StoreMeta;
    // biome-ignore lint/suspicious/noExplicitAny: no need to care about the document type of dependencies
    dependencies?: Array<MongoDBModel<any>>;
  }) {
    this.name = name;
    this.version = version;
    this.transform = transform;
    this.meta = meta;
    this.dependencies = dependencies;
  }
}
