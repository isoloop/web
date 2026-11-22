---
"markets": patch
---

A price alert fires once while exchanges sit on both sides of its threshold, and again only after no exchange has been past it for 10 s. It fired on every price that came back over the threshold. A rule set again unchanged no longer re-arms, and the `markets.alerts.create.v1` tool's description says how price rules fire. The same fix applies to every build.
