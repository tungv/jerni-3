import { MongoDBModel } from "@jerni/store-mongodb";
import type { MongoOps } from "@jerni/store-mongodb/lib/src/types";
import mapEvents from "jerni/lib/mapEvents";

interface BankAccountDocumentModel {
  id: string;
  name: string;
  balance: number;
}

declare module "jerni/type" {
  export interface LocalEvents {
    NEW_ACCOUNT_REGISTERED: {
      id: string;
      name: string;
    };

    ACCOUNT_DEPOSITED: {
      id: string;
      amount: number;
    };
  }
}

const model = new MongoDBModel<BankAccountDocumentModel>({
  name: "bank_accounts",
  version: "2",
  transform: mapEvents<MongoOps<BankAccountDocumentModel>>({
    NEW_ACCOUNT_REGISTERED(event) {
      return {
        insertOne: {
          id: event.payload.id,
          name: event.payload.name,
          balance: 0,
        },
      };
    },

    ACCOUNT_DEPOSITED(event) {
      return {
        updateOne: {
          where: { id: event.payload.id },
          changes: { $inc: { balance: event.payload.amount } },
        },
      };
    },
  }),
});

export default model;
