/**
 * Customs fetch function that handles username and password in the url
 * The reason for this is that fetch will throw an error if there is a username and password in the url
 */
export default async function customFetch(url: string, options: RequestInit): Promise<Response> {
  // check if there is a username and password in the url
  const urlObj = new URL(url);
  if (urlObj.username || urlObj.password) {
    // send the request with authorization header
    options.headers = {
      ...options.headers,
      authorization: `Basic ${btoa(`${urlObj.username}:${urlObj.password}`)}`,
    };

    // remove the username and password from the url
    urlObj.username = "";
    urlObj.password = "";

    return fetch(urlObj.toString(), options);
  }

  return fetch(url, options);
}
