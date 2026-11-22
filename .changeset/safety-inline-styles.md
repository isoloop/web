---
"site": patch
---

The Safety section of `/features/` says what a Content Security Policy needs: Isoloop runs under `script-src 'self'`, and a page that shows a surface needs `style-src 'self' 'unsafe-inline'` for the `style` attributes isolates render. It said that no `'unsafe-inline'` was needed.
