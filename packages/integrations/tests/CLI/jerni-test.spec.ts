import { afterEach, describe, expect, test } from "bun:test";
import testWrapper from "@jerni/jerni-3/test/testWrapper";
import { nanoid } from "nanoid";
import cleanUpTestDatabase from "../cleanUpTestDatabase";
import { BankAccountModel, BankAccountModel_2 } from "../models";
import initializeJourney from "./makeTestJourneyCli";

afterEach(cleanUpTestDatabase);

describe("Jerni Test", () => {
  test("a newly committed event should be persisted", async () => {
    const mongodbName = `jerni_integration_test_${nanoid()}`;

    // any port so that the initialization can be done
    process.env.EVENTS_SERVER = "http://localhost:3000";
    const mongoConfig = {
      url: "mongodb://localhost:27017",
      dbName: mongodbName,
    };
    const journey = await initializeJourney(mongoConfig);

    const devInstance = await testWrapper(journey);

    // commit event
    const event1 = await devInstance.append<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
    });

    await devInstance.waitFor(event1);

    const BankAccounts = await devInstance.getReader(BankAccountModel);

    const bankAccount = await BankAccounts.findOne({
      id: "123",
    });

    expect(bankAccount).toEqual({
      __op: 0,
      __v: 1,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 0,
    });
  });

  test("test journey should clear all the related collections before starting", async () => {
    const mongodbName = `jerni_integration_test_${nanoid()}`;

    // any port so that the initialization can be done
    process.env.EVENTS_SERVER = "http://localhost:3000";
    const mongoConfig = {
      url: "mongodb://localhost:27017",
      dbName: mongodbName,
    };
    const journey = await initializeJourney(mongoConfig);

    const devInstance = await testWrapper(journey);

    // commit event
    const event1 = await devInstance.append<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
    });

    await devInstance.waitFor(event1);

    const BankAccounts = await devInstance.getReader(BankAccountModel);

    const bankAccount = await BankAccounts.findOne({
      id: "123",
    });

    expect(bankAccount).toEqual({
      __op: 0,
      __v: 1,
      _id: expect.anything(),
      id: "123",
      name: "test",
      balance: 0,
    });

    // create another journey dev instance
    const devInstance2 = await testWrapper(journey);

    // commit event
    const event2 = await devInstance2.append<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
    });

    await devInstance2.waitFor(event2);

    const BankAccounts2 = await devInstance2.getReader(BankAccountModel_2);

    const bankAccounts = await BankAccounts2.find().toArray();

    // the second journey should not have the previous event
    expect(bankAccounts).toEqual([
      {
        __op: 0,
        __v: 1,
        _id: expect.anything(),
        id: "123",
        name: "test",
        balance: 0,
      },
    ]);
  });

  test("test journey should projects all the initial events before starting", async () => {
    const mongodbName = `jerni_integration_test_${nanoid()}`;

    // any port so that the initialization can be done
    process.env.EVENTS_SERVER = "http://localhost:3000";
    const mongoConfig = {
      url: "mongodb://localhost:27017",
      dbName: mongodbName,
    };
    const journey = await initializeJourney(mongoConfig);

    const devInstance = await testWrapper(journey, [
      {
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "1",
          name: "test1",
        },
      },
    ]);

    // commit event
    const event1 = await devInstance.append<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "2",
        name: "test2",
      },
    });

    await devInstance.waitFor(event1);

    const BankAccounts = await devInstance.getReader(BankAccountModel);

    const bankAccounts = await BankAccounts.find().toArray();

    expect(bankAccounts).toEqual([
      {
        __op: 0,
        __v: 1,
        _id: expect.anything(),
        id: "1",
        name: "test1",
        balance: 0,
      },
      {
        __op: 0,
        __v: 2,
        _id: expect.anything(),
        id: "2",
        name: "test2",
        balance: 0,
      },
    ]);
  });

  test("testInstance.waitAll should wait for all events to be processed", async () => {
    const mongodbName = `jerni_integration_test_${nanoid()}`;

    // any port so that the initialization can be done
    process.env.EVENTS_SERVER = "http://localhost:3000";
    const mongoConfig = {
      url: "mongodb://localhost:27017",
      dbName: mongodbName,
    };
    const journey = await initializeJourney(mongoConfig);

    const devInstance = await testWrapper(journey);

    // commit event
    await devInstance.append<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "123",
        name: "test",
      },
    });
    await devInstance.append<"ACCOUNT_DEPOSITED">({
      type: "ACCOUNT_DEPOSITED",
      payload: {
        id: "123",
        amount: 100,
      },
    });
    await devInstance.append<"NEW_ACCOUNT_REGISTERED">({
      type: "NEW_ACCOUNT_REGISTERED",
      payload: {
        id: "456",
        name: "test",
      },
    });

    await devInstance.waitAll();

    const BankAccounts = await devInstance.getReader(BankAccountModel_2);

    const bankAccounts = await BankAccounts.find().toArray();

    expect(bankAccounts).toEqual([
      {
        __op: 0,
        __v: 2,
        _id: expect.anything(),
        id: "123",
        name: "test",
        balance: 100,
      },
      {
        __op: 0,
        __v: 3,
        _id: expect.anything(),
        id: "456",
        name: "test",
        balance: 0,
      },
    ]);

    expect(devInstance.committed).toHaveLength(3);
    expect(devInstance.committed).toEqual([
      {
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "123",
          name: "test",
        },
        id: 1,
      },
      {
        type: "ACCOUNT_DEPOSITED",
        payload: {
          id: "123",
          amount: 100,
        },
        id: 2,
      },
      {
        type: "NEW_ACCOUNT_REGISTERED",
        payload: {
          id: "456",
          name: "test",
        },
        id: 3,
      },
    ]);
  });
});
