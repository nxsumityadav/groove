# Rebuilds test-fixtures/f1040-scanned-sample.pdf: a 200-DPI RGB-JPEG "scan"
# of the filled 1040 with black ink, like a real scanner or phone app emits.
# RGB matters: browsers decode RGB JPEGs natively (fast); grayscale JPEGs
# push pdf.js onto its slow JavaScript decoder and skew every measurement.
#
#   python3 backend/scripts/make-scanned-fixture.py
import fitz  # PyMuPDF
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "test-fixtures", "f1040-filled-sample.pdf")
OUT = os.path.join(ROOT, "test-fixtures", "f1040-scanned-sample.pdf")

# Re-ink the filled sample to black by rasterizing in grayscale first, then
# saving as RGB JPEG (scanners produce RGB files even for monochrome paper).
src = fitz.open(SRC)
out = fitz.open()
for i in [1, 2]:  # skip the FreeTaxUSA cover page
    gray = src[i].get_pixmap(dpi=200, colorspace=fitz.csGRAY)
    rgb = fitz.Pixmap(fitz.csRGB, gray)
    page = out.new_page(width=612, height=792)
    page.insert_image(page.rect, stream=rgb.tobytes("jpeg", jpg_quality=85))
out.save(OUT, deflate=True)

chk = fitz.open(OUT)
print("pages", len(chk), "| text chars", len(chk[0].get_text().strip()), "| bytes", os.path.getsize(OUT))
