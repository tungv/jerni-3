export default function formatUrl(url: URL) {
  const { username, password } = url;

  if (!username && !password) {
    return url.toString();
  }

  const masked = new URL(url);
  masked.password = "***";

  for (const [key, value] of masked.searchParams.entries()) {
    masked.searchParams.set(key, `${value.slice(0, 5)}...`);
  }

  return masked.toString();
}
