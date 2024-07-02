import { MongoDBModel } from "@jerni/store-mongodb";
import type { MongoOps } from "@jerni/store-mongodb/lib/src/types";
import mapEvents from "jerni/lib/mapEvents";
import { isNil, omitBy } from "lodash/fp";

export interface LicenseeDocumentModel {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: number;
}

declare module "jerni/type" {
  export interface SubscribingEventDefinitions {
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

export const LicenseeModel = new MongoDBModel({
  name: "licensees",
  version: "1",
  transform: mapEvents<MongoOps<LicenseeDocumentModel>>({
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
  }),
});
