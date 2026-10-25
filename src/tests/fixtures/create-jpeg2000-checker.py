"""Generate an original geometric JPX PDF regression fixture; no third-party artwork."""
from io import BytesIO
from pathlib import Path

from PIL import Image

image = Image.new("RGB", (32, 32))
colors = [(230, 20, 20), (20, 40, 230), (20, 180, 40), (230, 180, 20)]
for y in range(32):
    for x in range(32):
        image.putpixel((x, y), colors[(x // 16) + 2 * (y // 16)])
encoded = BytesIO()
image.save(encoded, format="JPEG2000", irreversible=False)
jpx = encoded.getvalue()
stream = b"q 32 0 0 32 0 0 cm /Im0 Do Q\n"
objects = [
    b"<< /Type /Catalog /Pages 2 0 R >>",
    b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 32 32] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>",
    b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"endstream",
    b"<< /Type /XObject /Subtype /Image /Width 32 /Height 32 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /JPXDecode /Length "
    + str(len(jpx)).encode() + b" >>\nstream\n" + jpx + b"\nendstream",
]
pdf = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
offsets = [0]
for i, obj in enumerate(objects, 1):
    offsets.append(len(pdf))
    pdf += str(i).encode() + b" 0 obj\n" + obj + b"\nendobj\n"
xref = len(pdf)
pdf += b"xref\n0 6\n0000000000 65535 f \n"
for offset in offsets[1:]:
    pdf += f"{offset:010d} 00000 n \n".encode()
pdf += b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + str(xref).encode() + b"\n%%EOF\n"
Path(__file__).with_name("jpeg2000-checker.pdf").write_bytes(pdf)
