import fs from "node:fs";
import hash_sum from "hash-sum";

// if the markdown file does not exists, create it with the frontmatter with the following structure:
// ---
// checksum: "checksum-for-no-events"
// ---
export default function ensureMarkDownFileExists(filePath: string) {
  const fileExists = fs.existsSync(filePath);

  const checksum = hash_sum([]);

  if (!fileExists) {
    fs.writeFileSync(filePath, `---\nchecksum: ${checksum}\n---`);
  }
}
