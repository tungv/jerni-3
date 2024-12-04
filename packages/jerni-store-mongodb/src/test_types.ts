import createJourney from "@jerni/jerni-3";
import type { Store } from "@jerni/jerni-3/types";
import type { Collection } from "mongodb";
import { type ClientDocumentModel, ClientModel } from "./client";
import { type LicenseeDocumentModel, LicenseeModel } from "./licensee";
import type MongoDBModel from "./model";
import makeMongoDBStore from "./store";

const modelId = { name: "modelId" } as MongoDBModel<{ id: number }>;
const modelName = { name: "modelName" } as MongoDBModel<{ name: string }>;
const modelAge = { name: "modelAge" } as MongoDBModel<{ age: boolean }>;

interface RedisStore extends Store<["r1", "rs1"] | ["r2", "rs2"]> {}
interface NumberStore extends Store<[1, 1.1] | [2, 2.2]> {}
interface IdStore extends Store<[10, string]> {}
interface ObjectStore extends Store<[{ objId: number }, { objId: number; name: string; age: number }]> {}

const redisStore = { name: "redis" } as RedisStore;
const numberStore = { name: "number" } as NumberStore;
const idStore = { name: "id" } as IdStore;
const objectStore = { name: "object" } as ObjectStore;

/**
 * Helper type to assert that two types are exactly equal
 *
 * @example
 * // Will evaluate to true
 * type Test = AssertEqual<{ a: string }, { a: string }>;
 *
 * // Will evaluate to false
 * type Test = AssertEqual<{ a: string }, { a: string; b?: number }>;
 */
type AssertEqual<T, U> = (<V>() => V extends T ? 1 : 2) extends <V>() => V extends U ? 1 : 2 ? true : false;
type MustBeTrue<Match extends true> = never;

async function main() {
  const mongoStore = await makeMongoDBStore({
    models: [modelName, modelAge, modelId, ClientModel, LicenseeModel],
    name: "test",
    dbName: "test",
    url: "test",
  });

  const journey = createJourney({
    stores: [numberStore, idStore, redisStore, objectStore, mongoStore],
    writeTo: "test",
    onError: () => {},
  });

  const readerAge = await journey.getReader(modelAge);
  const readerId = await journey.getReader(modelId);
  const readerName = await journey.getReader(modelName);
  const readerNum1 = await journey.getReader(1);
  const readerNum2 = await journey.getReader(2);
  const readerRedis1 = await journey.getReader("r1");
  const readerRedis2 = await journey.getReader("r2");
  const readerIdStore = await journey.getReader(10);
  const readerObject = await journey.getReader({ objId: 1 });
  const readerClient = await journey.getReader(ClientModel);
  const readerLicensee = await journey.getReader(LicenseeModel);

  [
    {} as MustBeTrue<AssertEqual<typeof readerId, Collection<{ id: number }>>>,
    {} as MustBeTrue<AssertEqual<typeof readerAge, Collection<{ age: boolean }>>>,
    {} as MustBeTrue<AssertEqual<typeof readerName, Collection<{ name: string }>>>,
    {} as MustBeTrue<AssertEqual<typeof readerNum1, 1.1>>,
    {} as MustBeTrue<AssertEqual<typeof readerNum2, 2.2>>,
    {} as MustBeTrue<AssertEqual<typeof readerRedis1, "rs1">>,
    {} as MustBeTrue<AssertEqual<typeof readerRedis2, "rs2">>,
    {} as MustBeTrue<AssertEqual<typeof readerIdStore, string>>,
    {} as MustBeTrue<AssertEqual<typeof readerObject, { objId: number; name: string; age: number }>>,
    {} as MustBeTrue<AssertEqual<typeof readerClient, Collection<ClientDocumentModel>>>,
    {} as MustBeTrue<AssertEqual<typeof readerLicensee, Collection<LicenseeDocumentModel>>>,
  ];
}
