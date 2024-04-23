import { Document } from "mongodb";
import { StoreMeta, TransformFn } from "./types";

export default class MongoDBModel<DocumentType extends Document> {
  name: string;
  version: string;
  transform: TransformFn<DocumentType>;
  meta?: StoreMeta;

  constructor({
    name,
    version,
    transform,
    meta,
  }: {
    name: string;
    version: string;
    transform: TransformFn<DocumentType>;
    meta?: StoreMeta;
  }) {
    this.name = name;
    this.version = version;
    this.transform = transform;
    this.meta = meta;
  }
}
