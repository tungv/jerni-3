export interface Message {
  id: string;
  data: string;
  event: string;
  retry?: number;
}

export default function messageListFromString(input: string) {
  const messages: Message[] = [];
  let line = "";
  let ignoreNextNewline = false;
  let data: string;
  let id: string;
  let event: string;
  let retry: undefined | number;
  let previousChar = "";
  let pendingIndex = 0;
  let isEndOfMessage = false;
  function handleParseLine(pIndex: number) {
    const result = parseLine(line);
    data = result.data ?? data;
    id = result.id ?? id;
    event = result.event ?? event;
    retry = result.retry ?? retry;
    if (isEndOfMessage) {
      if (typeof data === "string") {
        messages.push({
          id,
          data,
          event: event ?? "message",
          retry,
        });
      }
      // @ts-ignore trust me, this is fine
      id = void 0;
      // @ts-ignore trust me, this is fine
      data = void 0;
      // @ts-ignore trust me, this is fine
      event = void 0;
      retry = void 0;
      pendingIndex = pIndex;
    }
    line = "";
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    switch (char) {
      case "\r": {
        isEndOfMessage = previousChar === "\n" || previousChar === "\r";
        ignoreNextNewline = true;
        const pIndex = input[i + 1] === "\n" ? i + 2 : i + 1;
        handleParseLine(pIndex);
        break;
      }
      case "\n": {
        if (ignoreNextNewline) {
          ignoreNextNewline = false;
          break;
        }
        isEndOfMessage = previousChar === "\n";
        handleParseLine(i + 1);
        break;
      }
      default:
        line += char;
        break;
    }
    previousChar = char;
  }
  return {
    messages,
    leftoverData: input.substring(pendingIndex),
  };
}

function parseLine(input: string) {
  if (input.startsWith("data:")) {
    return { data: input.substring(5).trim() };
  }
  if (input.startsWith("id:")) {
    return { id: input.substring(3).trim() };
  }
  if (input.startsWith("event:")) {
    return {
      event: input.substring(6).trim(),
    };
  }
  if (input.startsWith("retry:")) {
    const val = Number(input.substring(6).trim());
    if (!Number.isNaN(val)) {
      if (Number.isInteger(val)) {
        return { retry: val };
      }
      return { retry: Math.round(val) };
    }
  }
  return {};
}
