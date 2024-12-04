import mapEvents from "@jerni/jerni-3/lib/mapEvents";
import Model from "./model";
import type { MongoOps as MongoDbTransformOutput } from "./types";

export interface ClientDocumentModel {
  id: string;
  licensee_id: string;
  name: string;
  description: string;
  alias: string;
  activated: boolean;
  created_by: string;
  updated_by: string;
  created_at: number;
  updated_at: number;

  insertion_order: number;
}

declare module "@jerni/jerni-3/types" {
  interface SubscribingEventDefinitions {
    "ACCOUNT:CLIENT_ORGANIZATION_ACTIVATED": {
      id: string;
      updated_by: string;
      updated_at: number;
    };
  }
}

const transform = mapEvents<MongoDbTransformOutput<ClientDocumentModel>>({});

export const ClientModel = new Model({
  name: "clients",
  version: "2",
  transform,
});
