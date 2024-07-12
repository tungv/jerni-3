import { MongoDBModel } from "@jerni/store-mongodb";
import mapEvents from "jerni/lib/mapEvents";

interface BankAccountDocumentModel {
  id: string;
  name: string;
  balance: number;
}

declare module "@jerni/jerni-3/types" {
  export interface CommittingEventDefinitions {
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
  version: "1",
  transform: mapEvents({
    NEW_ACCOUNT_REGISTERED(event) {
      return {
        insertOne: {
          id: event.payload.id,
          name: event.payload.name,
          balance: 0,
        },
      };
    },
  }),
});

export default model;
