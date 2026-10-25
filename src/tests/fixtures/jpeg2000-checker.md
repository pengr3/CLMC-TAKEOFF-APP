# JPEG2000 decoder regression input

`jpeg2000-checker.pdf` is an original generated 32 × 32 four-color geometric
checker, encoded losslessly as JPEG2000 and embedded with `/JPXDecode`. It contains
no external artwork or construction plan. `create-jpeg2000-checker.py` documents
its generation with Pillow/OpenJPEG; tests consume the checked-in PDF and do not
need Python to regenerate it.

The decoder must paint colored content. A missing PDF.js WASM base can otherwise
make `page.render()` resolve successfully with an entirely white canvas. The
regression checks actual decoded pixels and the missing-asset negative control,
rather than accepting a resolved render promise as proof of a rendered page.
