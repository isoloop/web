---
"site": minor
---

`/features/` gains an eleventh feature, **Tools for agents** (experimental): a requestable topic with a `tool` description, listed in `agents.expose`, becomes a tool a coding agent calls through `npx isoloop mcp` in development, or a browser's agent through `@isoloop/webmcp` where the browser has WebMCP (Chromium 158 and Firefox 159, both behind a flag). It has a type-checked sample, links to the Agents guide and to the markets dashboard's two tools, and says what the hints don't do and what Firefox's agent doesn't see. The landing page's strip lists it too, and the install block gains `@isoloop/webmcp@next`. The library pin moves to isoloop/isoloop `c8279f6`, which has the Agents guide.
