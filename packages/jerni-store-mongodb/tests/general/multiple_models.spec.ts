import test from "ava";
import { MongoDBModel } from "../../src";
import makeMongoDBStore from "../../src/store";
import { JourneyCommittedEvent } from "../../src/types";

test("it should insert data to all models", async (t) => {
  const model1 = new MongoDBModel({
    name: "model_1",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.id % 2 === 0) return;
      return [
        {
          insertOne: {
            id: event.id,
          },
        },
      ];
    },
  });

  const model2 = new MongoDBModel({
    name: "model_2",
    version: "1",
    transform(event: JourneyCommittedEvent) {
      if (event.id % 2 === 1) return;
      return [
        {
          insertOne: {
            id: event.id,
          },
        },
      ];
    },
  });

  const store = await makeMongoDBStore({
    name: "test_register_models",
    dbName: "mongodb_multiple_models_test",
    url: "mongodb://127.0.0.1:27017",
    models: [model1, model2],
  });

  await store.clean();
  await store.handleEvents([
    {
      id: 1,
      type: "event_1",
      payload: {},
    },
    {
      id: 2,
      type: "event_2",
      payload: {},
    },
    {
      id: 3,
      type: "event_1",
      payload: {},
    },
  ]);

  const reader1 = store.getDriver(model1);
  const reader2 = store.getDriver(model2);

  const docs1 = await reader1.find({}).toArray();
  const docs2 = await reader2.find({}).toArray();

  t.is(docs1.length, 2);
  t.is(docs2.length, 1);

  t.log(docs1);
  t.log(docs2);

  await store.dispose();
});
