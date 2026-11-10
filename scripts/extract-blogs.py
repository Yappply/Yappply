"""One-off extractor: public/blogs PDFs -> src/components/landing/blogContent.json"""
import json
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "public" / "blogs"
OUT = ROOT / "src" / "components" / "landing" / "blogContent.json"
META = ROOT / "src" / "components" / "landing" / "blogMeta.json"

PAIRS = [
    ("bubble", "#EEE8FF", "#C9B8FF"),
    ("mic", "#F4FBCF", "#DDF55B"),
    ("quote", "#FFE3F1", "#FF8CC6"),
    ("ear", "#EEE8FF", "#C9B8FF"),
    ("star", "#F4FBCF", "#DDF55B"),
    ("tie", "#FFE3F1", "#FF8CC6"),
    ("chart", "#EEE8FF", "#C9B8FF"),
    ("yappy", "#F4FBCF", "#DDF55B"),
    ("spark", "#FFE3F1", "#FF8CC6"),
]

CATEGORY_BY_SLUG = {
    "ielts-speaking-band-7-tips": "Speaking",
    "understand-english-but-cant-speak": "Speaking",
    "how-to-think-in-english": "Mindset",
    "how-to-stop-filler-words-english": "Speaking",
    "overcome-fear-of-speaking-english": "Mindset",
    "how-to-practice-english-speaking-alone": "Practice",
    "how-to-speak-english-fluently": "Practice",
    "introduce-yourself-job-interview-english": "Speaking",
    "how-to-improve-english-pronunciation": "Speaking",
    "how-to-improve-articulation": "Speaking",
    "english-phrases-phone-video-calls": "Speaking",
    "how-to-build-confidence-speaking-english": "Mindset",
    "english-conversation-topics": "Practice",
    "best-apps-practice-english-speaking": "Product",
    "ai-vs-human-tutor-english-speaking": "Product",
    "english-phrases-office-meetings": "Speaking",
}


def normalize(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff")
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return text


def page_lines(page_text: str) -> list[str]:
    lines = []
    for raw in normalize(page_text).splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if line:
            lines.append(line)
    return lines


def is_running_header(line: str, title_words: set[str]) -> bool:
    words = re.findall(r"[a-z0-9]+", line.lower())
    if len(words) < 4 or not title_words:
        return False
    overlap = sum(1 for word in words if word in title_words)
    return overlap / len(words) >= 0.75


def strip_chrome(lines: list[str], title: str) -> list[str]:
    title_words = set(re.findall(r"[a-z0-9]+", title.lower()))
    cleaned = []
    dropped_header = False
    for line in lines:
        if re.fullmatch(r"Page \d+ of \d+", line):
            dropped_header = False
            continue
        if is_running_header(line, title_words):
            dropped_header = True
            continue
        words = re.findall(r"[a-z0-9]+", line.lower())
        if dropped_header and words and len(words) <= 3 and all(word in title_words for word in words):
            continue
        dropped_header = False
        cleaned.append(line)
    return cleaned


def drop_seo(lines: list[str]) -> list[str]:
    out = []
    skipping = False
    for line in lines:
        if line.lower() == "seo essentials":
            continue
        if line == "Field Value":
            skipping = True
            continue
        if skipping:
            if line.lower().startswith("suggested internal links"):
                # The value wraps onto the following lines; stop skipping at the next real heading-like
                # line is handled by consuming until a line that looks like resumed prose. The table
                # is always the end of page 1, so keep skipping.
                continue
            continue
        out.append(line)
    return out


HEADING_START = re.compile(
    r"^(How |Why |What |When |Where |The |Part \d+\s*\(|Common |Frequently |Topics |Starting |Giving |"
    r"Interrupting |Making |Key |Final |Practice |Step \d|Tips |FAQ |Conclusion|Wrapping |Small talk|"
    r"At work|A realistic|A \d|8 tips|7 steps|Seven |To open|To give|To agree|To disagree|To interrupt|"
    r"To ask|To check|To make|To hand|To close|For each )",
    re.I,
)


def is_heading(line: str) -> bool:
    if len(line) > 88 or len(line) < 8:
        return False
    if not (line[0].isupper() or line[0].isdigit()):
        return False
    if re.search(r'[.!?]"?$', line):
        return False
    if line.endswith(","):
        return False
    if re.match(r"^\d+\.\s", line):
        return False
    if line[0] in "\"'":
        return False
    words = line.split()
    if len(words) < 2 or len(words) > 14:
        return False
    if "," in line and not line.endswith(":"):
        return False
    if re.match(r"^(Beginner|Intermediate|Advanced|Early|Upper)\b", line):
        return len(line) < 52 or "(" in line or line.endswith(":")
    return bool(HEADING_START.match(line))


def is_label(line: str) -> bool:
    if is_heading(line):
        return False
    if len(line) > 58 or len(line) < 8:
        return False
    if re.search(r"[.!?,:;]", line):
        return False
    if line[0] in "\"'":
        return False
    words = line.split()
    if not 2 <= len(words) <= 8:
        return False
    return line[0].isupper()


def should_break(last_line: str, nxt: str) -> bool:
    if is_heading(nxt):
        return True
    if is_label(last_line) and is_label(nxt):
        return True
    if len(last_line) >= 64:
        return False
    if nxt[:1].islower():
        return False
    if re.search(r'[.!?]"?$', last_line):
        return True
    if is_heading(last_line) or is_label(last_line):
        return True
    return False


def blocks_from_lines(lines: list[str]) -> list[dict]:
    paragraphs: list[str] = []
    buf = ""
    last = ""
    for line in lines:
        if buf and should_break(last, line):
            paragraphs.append(re.sub(r"\s+", " ", buf).strip())
            buf = line
        elif buf:
            buf = f"{buf} {line}"
        else:
            buf = line
        last = line
    if buf.strip():
        paragraphs.append(re.sub(r"\s+", " ", buf).strip())

    blocks: list[dict] = []
    for text in paragraphs:
        if not text:
            continue
        if is_heading(text):
            blocks.append({"t": "h2", "text": text.rstrip(":")})
        elif re.match(r"^\d+\.\s+\S", text) or is_label(text):
            blocks.append({"t": "li", "text": re.sub(r"^\d+\.\s+", "", text)})
        else:
            blocks.append({"t": "p", "text": text})
    return blocks


def excerpt_of(blocks: list[dict]) -> str:
    for block in blocks:
        if block["t"] == "p" and len(block["text"]) > 80:
            text = block["text"]
            if len(text) <= 180:
                return text
            cut = text[:180].rsplit(" ", 1)[0]
            return cut.rstrip(".,;:") + "…"
    return ""


def words_of(blocks: list[dict]) -> int:
    return len(re.findall(r"[A-Za-z0-9']+", " ".join(b["text"] for b in blocks)))


def main():
    pdfs = sorted(PDF_DIR.glob("*.pdf"), key=lambda p: (p.stat().st_mtime, p.name), reverse=True)
    # Same timestamp: keep a stable, readable order (IELTS before the other 9:49 file).
    pdfs.sort(key=lambda p: (-p.stat().st_mtime, p.name.lower()))
    posts = []
    for index, pdf in enumerate(pdfs):
        reader = PdfReader(str(pdf))
        pages = [page_lines(page.extract_text() or "") for page in reader.pages]
        slug_match = None
        flat = "\n".join(line for page in pages for line in page)
        found = re.search(r"URL slug\s+([a-z0-9-]+)", flat)
        slug = found.group(1) if found else re.sub(r"[^a-z0-9]+", "-", pdf.stem.lower()).strip("-")
        # Title is the wrapped lines before the date.
        first = pages[0]
        date = ""
        author = ""
        title_lines = []
        rest_start = 0
        for i, line in enumerate(first):
            m = re.match(
                r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}\s+·\s+@(.+)$",
                line,
            )
            if m:
                date = line.split("·")[0].strip()
                author = m.group(2).strip()
                rest_start = i + 1
                break
            title_lines.append(line)
        title = " ".join(title_lines)
        body_lines = []
        for pi, page in enumerate(pages):
            chunk = page[rest_start:] if pi == 0 else page
            chunk = strip_chrome(chunk, title)
            if pi == 0:
                chunk = drop_seo(chunk)
            body_lines.extend(chunk)
        body_blocks = blocks_from_lines(body_lines)
        cover, tint, circle = PAIRS[index % len(PAIRS)]
        category = CATEGORY_BY_SLUG.get(slug, "Speaking")
        minutes = max(3, round(words_of(body_blocks) / 220))
        posts.append(
            {
                "slug": slug,
                "title": title,
                "category": category,
                "minutes": minutes,
                "excerpt": excerpt_of(body_blocks),
                "date": date,
                "author": author,
                "cover": cover,
                "tint": tint,
                "circle": circle,
                "blocks": body_blocks,
            }
        )
        print(f"{index+1:02d} {slug} [{category}] {minutes}m blocks={len(body_blocks)} {title}")

    OUT.write_text(json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")
    meta = [{key: post[key] for key in ("slug", "title", "category", "minutes", "excerpt", "date", "author", "cover", "tint", "circle")} for post in posts]
    META.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
