---
bump: minor
---
VerticalForm: `stretch` is forwarded to the rail, so a form can take the packed look (blocks keeping `minBlock`'s size and accumulating from the top) instead of the picture filling the rail's height. It stays on by default here, against `Minimap`'s own default: a form's rail is an index of field names, and a smaller picture collides their pills, so the rail thins them out (a 24-field form shows 24 names stretched and 12 packed). `Minimap`'s `stretch` documents which rails the packed look suits: those whose markers tile content that grows, like a conversation, rather than ones annotating a fixed document or indexing names.
