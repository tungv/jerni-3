import { AnyBulkWriteOperation } from "mongodb";
import {
  DeleteManyOp,
  DeleteOneOp,
  InsertManyOp,
  InsertOneOp,
  MongoOps,
  UpdateManyOp,
  UpdateOneOp,
} from "../types";

interface ChangeWithOp<Change> {
  change: Change;
  __op: number;
  __v: number;
}

type OptimisticDocument = {
  __v: number;
  __op: number;
  [key: string]: any;
};

interface Newer {
  $or: [{ __v: { $gt: number } }, { __v: number; __op: { $gte: number } }];
}

interface Older {
  $or: [{ __v: { $lt: number } }, { __v: number; __op: { $lt: number } }];
}

function newerThan<T extends Record<string, any>>(
  where: { __v: number; __op: number },
  original: T = {} as T,
): (Newer & T) | { $and: [T, Newer] } {
  // we only insert if this query doesn't match
  const gtEventId = { __v: { $gt: where.__v } };
  const gtOpCounterInSameEvent = { __op: { $gte: where.__op }, __v: where.__v };

  if ("$or" in original) {
    return {
      $and: [original, { $or: [gtEventId, gtOpCounterInSameEvent] }],
    };
  }

  return {
    $or: [gtEventId, gtOpCounterInSameEvent],
    ...original,
  };
}

function olderThan<T extends Record<string, any>>(
  where: { __v: number; __op: number },
  original: T = {} as T,
): (Older & T) | { $and: [T, Older] } {
  const c = {
    $or: [
      { __v: { $lt: where.__v } },
      { __v: where.__v, __op: { $lt: where.__op } },
    ],
  } satisfies Older;

  if ("$or" in original) {
    return {
      $and: [original, c],
    };
  }

  return { ...c, ...original };
}

export default function getBulkOperations(
  ops: ChangeWithOp<MongoOps<OptimisticDocument>>[],
): AnyBulkWriteOperation<OptimisticDocument>[] {
  let opCounter = 0;

  return ops.flatMap(
    ({ change, __v }): AnyBulkWriteOperation<OptimisticDocument>[] => {
      if ("insertOne" in change) {
        return insertOne(change, __v);
      }

      if ("insertMany" in change) {
        return insertMany(change, __v);
      }

      if ("updateOne" in change) {
        return updateOne(change, __v);
      }

      if ("updateMany" in change) {
        return updateMany(change, __v);
      }

      if ("deleteOne" in change) {
        return deleteOne(change, __v);
      }

      if ("deleteMany" in change) {
        return deleteMany(change, __v);
      }

      throw new Error(`Unknown op type: ${JSON.stringify(change)}`);
    },
  );

  function insertOne(change: InsertOneOp<OptimisticDocument>, __v: number) {
    const __op = opCounter++;
    return [
      {
        updateOne: {
          filter: newerThan({ __v, __op }),
          upsert: true,
          update: {
            $setOnInsert: {
              ...change.insertOne,
              __v,
              __op,
            },
          },
        },
      },
    ];
  }

  function insertMany(change: InsertManyOp<OptimisticDocument>, __v: number) {
    return change.insertMany.map((document) => {
      const __op = opCounter++;
      return {
        updateOne: {
          filter: newerThan({ __v, __op }),
          upsert: true,
          update: {
            $setOnInsert: {
              ...document,
              __v,
              __op,
            },
          },
        },
      };
    });
  }

  function updateOne(change: UpdateOneOp<OptimisticDocument>, __v: number) {
    const __op = opCounter++;
    const filter = olderThan({ __v, __op }, change.updateOne.where);

    if ("changes" in change.updateOne) {
      const changes = appendOptimisticSet(change.updateOne.changes, __v, __op);

      // updating with changes
      return [
        {
          updateOne: {
            filter,
            update: changes,
            arrayFilters: change.updateOne.arrayFilters,
          },
        },
      ];
    }

    // update with pipeline
    const pipeline = [
      ...change.updateOne.pipeline,
      {
        $set: {
          __v,
          __op,
        },
      },
    ];
    return [
      {
        updateOne: {
          filter,
          update: pipeline,
          arrayFilters: change.updateOne.arrayFilters,
        },
      },
    ];
  }

  function updateMany(change: UpdateManyOp<OptimisticDocument>, __v: number) {
    const __op = opCounter++;
    const filter = olderThan({ __v, __op }, change.updateMany.where);

    if ("changes" in change.updateMany) {
      const changes = appendOptimisticSet(change.updateMany.changes, __v, __op);

      // updating with changes
      return [
        {
          updateMany: {
            filter,
            update: changes,
            arrayFilters: change.updateMany.arrayFilters,
          },
        },
      ];
    }

    // update with pipeline
    const pipeline = [
      ...change.updateMany.pipeline,
      {
        $set: {
          __v,
          __op,
        },
      },
    ];
    return [
      {
        updateMany: {
          filter,
          update: pipeline,
          arrayFilters: change.updateMany.arrayFilters,
        },
      },
    ];
  }

  function deleteOne(change: DeleteOneOp<OptimisticDocument>, __v: number) {
    const __op = opCounter++;
    return [
      {
        deleteOne: {
          filter: olderThan({ __v, __op }, change.deleteOne.where),
        },
      },
    ];
  }
  function deleteMany(change: DeleteManyOp<OptimisticDocument>, __v: number) {
    const __op = opCounter++;
    return [
      {
        deleteMany: {
          filter: olderThan({ __v, __op }, change.deleteMany.where),
        },
      },
    ];
  }
}

function appendOptimisticSet(
  changes: { [key: string]: any },
  __v: number,
  __op: number,
): { [key: string]: any } {
  const optimistic = {
    ...changes,
  };

  if ("$set" in changes) {
    optimistic.$set = {
      ...changes.$set,
      __v,
      __op,
    };
  } else {
    optimistic.$set = {
      __v,
      __op,
    };
  }

  return optimistic;
}
