import MongoDBModel from "./model";

export default function getCollectionName(model: MongoDBModel<any>) {
  return `${model.name}_v${model.version}`;
}
