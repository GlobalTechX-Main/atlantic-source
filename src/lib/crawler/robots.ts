export interface RobotsPolicy {
  disallowedPaths: string[];
  crawlDelaySeconds?: number;
}

export function parseRobotsTxt(content: string, userAgent: string = "AtlanticSourceBot"): RobotsPolicy {
  const disallowedPaths: string[] = [];
  let crawlDelaySeconds: number | undefined;

  const lines = content.split(/\r?\n/);
  let isCurrentAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "user-agent") {
      const agentVal = value.toLowerCase();
      isCurrentAgent = agentVal === "*" || agentVal.includes(userAgent.toLowerCase());
    } else if (isCurrentAgent) {
      if (key === "disallow" && value) {
        disallowedPaths.push(value);
      } else if (key === "crawl-delay") {
        const delay = parseFloat(value);
        if (!isNaN(delay)) {
          crawlDelaySeconds = delay;
        }
      }
    }
  }

  return { disallowedPaths, crawlDelaySeconds };
}

export function isPathDisallowed(path: string, policy: RobotsPolicy): boolean {
  for (const disallow of policy.disallowedPaths) {
    if (disallow === "/") return true;
    if (path.startsWith(disallow)) return true;
  }
  return false;
}
