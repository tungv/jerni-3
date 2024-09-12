import fs from "node:fs";
import yaml from "yaml";

export default function ensureFileExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    const content = {
      checksum: "",
      events: [],
    };

    const stringifiedContent = yaml.stringify(content);
    fs.writeFileSync(filePath, stringifiedContent);
  }
}
