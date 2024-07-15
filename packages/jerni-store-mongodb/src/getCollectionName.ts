export default function getCollectionName(model: { name: string; version: string }): string {
  return `${model.name}_v${model.version}`;
}
