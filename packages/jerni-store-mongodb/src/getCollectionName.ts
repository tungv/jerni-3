import type MongoDBModel from "./model";

// biome-ignore lint/suspicious/noExplicitAny: any is used to prevent Typescript constraint error when calling getCollectionName
export default function getCollectionName(model: MongoDBModel<any>) {
  return `${model.name}_v${model.version}`;
}
