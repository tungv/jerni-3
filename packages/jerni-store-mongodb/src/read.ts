import { Db, Document, UpdateFilter } from "mongodb";
import getCollectionName from "./getCollectionName";
import MongoDBModel from "./model";
import { JourneyCommittedEvent } from "./types";

let currentModel: MongoDBModel<any> | null = null;

export class Signal<DocumentType extends Document> {
  private model: MongoDBModel<DocumentType>;
  private pipeline: UpdateFilter<DocumentType>[];
  private slotIndex: number;

  constructor(
    model: MongoDBModel<DocumentType>,
    pipeline: UpdateFilter<DocumentType>[],
    slotIndex: number,
  ) {
    this.model = model;
    this.pipeline = pipeline;
    this.slotIndex = slotIndex;
  }

  async execute(db: Db) {
    const collectionName = getCollectionName(this.model);
    const collection = db.collection<DocumentType>(collectionName);

    const res = await collection.aggregate(this.pipeline).toArray();

    // write to the slot
    let slots = modelSlotsMap.get(this.model);

    if (!slots) {
      slots = [];
      modelSlotsMap.set(this.model, slots);
    }

    console.log(
      "writing to model=%s slot[%d]",
      this.model.name,
      this.slotIndex,
      res,
    );
    slots[this.slotIndex] = res;

    return res;
  }
}

const modelSlotsMap = new Map<
  MongoDBModel<any>,
  Array<Document[] | null> | null
>();
let currentModelSlotIndex = 0;

export function runWithModel<DocumentType extends Document>(
  model: MongoDBModel<DocumentType>,
  event: JourneyCommittedEvent,
) {
  currentModel = model;
  currentModelSlotIndex = 0;

  const res = model.transform(event);
  currentModel = null;

  return res || [];
}

export function clearModelSlots() {
  modelSlotsMap.clear();
}

export default function readPipeline<DocumentType extends Document>(
  pipeline: UpdateFilter<DocumentType>[],
): Document[] {
  const model = currentModel as MongoDBModel<DocumentType>;

  const slots = modelSlotsMap.get(model);
  if (!slots) {
    const slot: Array<Document[]> = [];
    modelSlotsMap.set(model, slot);
    throw new Signal(model, pipeline, 0);
  }

  const res = slots[currentModelSlotIndex];
  console.log(
    "reading from model=%s slot[%d], got:",
    model.name,
    currentModelSlotIndex,
    res,
  );

  if (res == null) {
    throw new Signal(model, pipeline, currentModelSlotIndex);
  }

  currentModelSlotIndex++;
  return res;
}
