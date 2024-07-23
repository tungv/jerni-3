import { initJourney } from "./initJourney";

function getEventsServerUrl() {
  if (!process.env.EVENTS_SERVER) {
    return "";
  }

  const eventsServerUrl = new URL(process.env.EVENTS_SERVER);
  if (process.env.EVENTS_SERVER_KEY) {
    eventsServerUrl.username = process.env.EVENTS_SERVER_KEY;
  }
  if (process.env.EVENTS_SERVER_SECRET) {
    eventsServerUrl.password = process.env.EVENTS_SERVER_SECRET;
  }

  return eventsServerUrl.toString();
}

export default async function initializeJourney(eventsServer = getEventsServerUrl()) {
  const { journey } = await initJourney(eventsServer, []);

  return journey;
}
