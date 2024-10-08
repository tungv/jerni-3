import hash from "hash-sum";
import type { Db, Document, UpdateFilter } from "mongodb";
import getCollectionName from "./getCollectionName";
import type MongoDBModel from "./model";
import type { JourneyCommittedEvent } from "./types";

export class Signal<DocumentType extends Document> {
  private model: MongoDBModel<DocumentType>;
  private pipeline: UpdateFilter<DocumentType>[];

  constructor(model: MongoDBModel<DocumentType>, pipeline: UpdateFilter<DocumentType>[]) {
    this.model = model;
    this.pipeline = pipeline;
  }

  async execute(db: Db) {
    const collectionName = getCollectionName(this.model);
    const collection = db.collection<DocumentType>(collectionName);

    const res = this.pipeline.length === 0 ? [] : await collection.aggregate(this.pipeline).toArray();

    // write to the slot
    let slots = modelSlotsMap.get(this.model);

    if (!slots) {
      slots = new Map();
      modelSlotsMap.set(this.model, slots);
    }

    // console.log("writing to model=%s slot[%d]", this.model.name, this.slotIndex, res);
    slots.set(hash(this.pipeline), res);

    return res;
  }
}

// const modelSlotsMap = new Map<MongoDBModel<Document>, Array<Document[] | null> | null>();
// biome-ignore lint/suspicious/noExplicitAny: 'Document' is assignable to the constraint of type 'DocumentType', but 'DocumentType' could be instantiated with a different subtype of constraint 'Document'
const modelSlotsMap = new Map<MongoDBModel<any>, Map<any, any[] | null>>();

// let currentModel: MongoDBModel<Document> | null = null;
// biome-ignore lint/suspicious/noExplicitAny: 'Document' is assignable to the constraint of type 'DocumentType', but 'DocumentType' could be instantiated with a different subtype of constraint 'Document'
let currentModel: MongoDBModel<any> | null = null;

export function runWithModel<DocumentType extends Document>(
  model: MongoDBModel<DocumentType>,
  event: JourneyCommittedEvent,
) {
  currentModel = model;

  try {
    const res = model.transform(event);

    return res || [];
  } finally {
    currentModel = null;
  }
}

export function clearModelSlots() {
  // clear all slots
  for (const slots of modelSlotsMap.values()) {
    slots.clear();
  }
  modelSlotsMap.clear();
}

export default function readPipeline<DocumentType extends Document>(
  pipeline: UpdateFilter<DocumentType>[],
): DocumentType[];
export default function readPipeline<DocumentType extends Document>(
  model: MongoDBModel<DocumentType>,
  pipeline: UpdateFilter<DocumentType>[],
): DocumentType[];

export default function readPipeline<DocumentType extends Document>(
  modelOrPipeline: MongoDBModel<DocumentType> | UpdateFilter<DocumentType>[],
  pipeline?: UpdateFilter<DocumentType>[],
): DocumentType[] {
  if (Array.isArray(modelOrPipeline)) {
    return readPipelineSameCollection(modelOrPipeline);
  }

  if (!pipeline) {
    throw new Error("pipeline is required when calling readPipeline with model");
  }

  return readPipelineDifferentCollection(modelOrPipeline, pipeline);
}

function readPipelineDifferentCollection<DocumentType extends Document>(
  model: MongoDBModel<DocumentType>,
  pipeline: UpdateFilter<DocumentType>[],
): DocumentType[] {
  const slots = modelSlotsMap.get(model);
  if (!slots) {
    const slot = new Map();
    modelSlotsMap.set(model, slot);
    throw new Signal<DocumentType>(model, pipeline);
  }

  const res = slots.get(hash(pipeline));
  // console.log("reading from model=%s, got:", model.name, res);

  if (res == null) {
    throw new Signal<DocumentType>(model, pipeline);
  }

  return res;
}

function readPipelineSameCollection<DocumentType extends Document>(
  pipeline: UpdateFilter<DocumentType>[],
): DocumentType[] {
  const model = currentModel;

  if (!model) {
    throw new Error("readPipeline must be called within transform function of a model");
  }

  const slots = modelSlotsMap.get(model);
  if (!slots) {
    const slot = new Map();
    modelSlotsMap.set(model, slot);
    throw new Signal<DocumentType>(model, pipeline);
  }

  const res = slots.get(hash(pipeline));
  // console.log("reading from model=%s, got:", model.name, res);

  if (res == null) {
    throw new Signal<DocumentType>(model, pipeline);
  }

  return res;
}

/**
 * call this function within a projection to mark the output as large
 * large output will wait for all the previous projections to finish before it's executed
 *
 * calling this function multiple times will only mark the output as large once and it's not recommended.
 * there is no way to unmark the output as large once it's marked
 */
export function large(): void {
  readPipeline([]);
}
