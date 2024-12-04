import mapEvents from "@jerni/jerni-3/lib/mapEvents";
import { isNil, omitBy } from "lodash/fp";
import Model from "./model";
import type { MongoOps as MongoDbTransformOutput } from "./types";

export interface LicenseeDocumentModel {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: number;
}

declare module "@jerni/jerni-3/types" {
  interface SubscribingEventDefinitions {
    "SCANNER:LICENSEE_CREATED": {
      id: string;
      name: string;
      description: string;
      created_at: number;
      created_by: string;

      // new
      slug: string;
    };

    "SCANNER:LICENSEE_UPDATED": {
      id: string;
      name: string;
      description?: string;
      deleted?: boolean;
    };
  }
}

const transform = mapEvents<MongoDbTransformOutput<LicenseeDocumentModel>>({
  "SCANNER:LICENSEE_CREATED"(event) {
    const { id, name, description, created_at, slug } = event.payload;

    return {
      insertOne: {
        id,
        name,
        description,
        createdAt: created_at,
        slug,
      },
    };
  },
  "SCANNER:LICENSEE_UPDATED"(event) {
    const { id, name, description, deleted } = event.payload;

    if (deleted) {
      return {
        deleteOne: {
          where: { id },
        },
      };
    }

    return {
      updateOne: {
        where: { id },
        changes: {
          $set: omitBy(isNil, {
            name,
            description,
          }),
        },
      },
    };
  },
});

export const LicenseeModel = new Model({
  name: "licensees",
  version: "1",
  transform,
});
