---
'markets': patch
---

In the Isoloop builds, the widgets that show the current value per key read it with a watcher (`useWatch`) instead of a subscription: the price tables (`prices`) and the alerts panel's rules (`alertRules`). The bus sends each of them only the newest value per key, at most one view per committed render. The charts, sparklines, trades tables and alert lists still read every record. The native builds are unchanged.
