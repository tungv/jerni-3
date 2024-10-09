import readEventsFromMarkdown from "@jerni/jerni-3/dev-cli/readEventsFromMarkdown";

export default async function shouldCleanStart(): Promise<boolean> {
  // @ts-expect-error
  const absoluteEventsFilePath = globalThis.__JERNI_EVENTS_FILE_PATH__;
  const { realChecksum, fileChecksum } = await readEventsFromMarkdown(absoluteEventsFilePath);

  // if checksum and events not match, need to clean start
  return realChecksum !== fileChecksum;
}
