export default function formatUrl(url: URL) {
  const { username, password } = url;

  if (!username && !password) {
    return url.toString();
  }

  const masked = new URL(url);
  masked.password = "********";

  return masked.toString();
}
