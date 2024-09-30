import { MongoDBModel } from "@jerni/store-mongodb";
import type { MongoOps } from "@jerni/store-mongodb/types";
import mapEvents from "jerni/lib/mapEvents";
import type { Collection, Document, WithId } from "mongodb";

interface BankAccountDocumentModel {
  id: string;
  name: string;
  balance: number;
}

declare module "@jerni/jerni-3/types" {
  export interface SubscribingEventDefinitions {
    NEW_ACCOUNT_REGISTERED: {
      id: string;
      name: string;
    };

    ACCOUNT_DEPOSITED: {
      id: string;
      amount: number;
    };
  }

  type OptimisticDocumentType<T> = T & {
    __op: number;
    __v: number;
  };

  export interface GetReaderFn {
    // biome-ignore lint/style/useShorthandFunctionType: need to be interface to override signature
    <DocumentType extends Document>(
      model: MongoDBModel<DocumentType>,
    ): Promise<Collection<OptimisticDocumentType<WithId<DocumentType>>> & AsyncDisposable>;
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
