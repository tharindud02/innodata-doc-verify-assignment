export type TextNodeSlice = { node: Text; start: number; end: number };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function prepareForMatch(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ");
}

function flexiblePattern(phrase: string): RegExp {
  const tokens = prepareForMatch(phrase)
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return /$^/;
  const parts = tokens.map((t) => escapeRegex(t));
  return new RegExp(parts.join("[\\s\\W]{0,16}"), "i");
}

function tryFlexibleMatch(text: string, phrase: string): [number, number] | null {
  const trimmed = prepareForMatch(phrase).trim();
  if (!trimmed) return null;
  const match = flexiblePattern(trimmed).exec(text);
  if (match?.index != null) {
    return [match.index, match.index + match[0].length];
  }
  return null;
}

export function findCitationRange(
  text: string,
  citation: string
): [number, number] | null {
  const trimmed = prepareForMatch(citation).trim();
  if (!trimmed) return null;

  const direct = tryFlexibleMatch(text, trimmed);
  if (direct) return direct;

  const firstSentence = trimmed.split(/[.!?]/)[0]?.trim() ?? "";
  if (firstSentence.length >= 20) {
    const sentence = tryFlexibleMatch(text, firstSentence);
    if (sentence) return sentence;
  }

  const words = trimmed.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length >= 4) {
    const anchor = words.slice(0, 4).join(" ");
    const partial = tryFlexibleMatch(text, anchor);
    if (partial) return partial;
  }

  return null;
}

export function clearHighlights(root: HTMLElement): void {
  const marks = Array.from(
    root.querySelectorAll("mark[data-citation-highlight='true']")
  );
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }
}

export function collectTextNodeSlices(root: HTMLElement): {
  text: string;
  slices: TextNodeSlice[];
} {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const slices: TextNodeSlice[] = [];
  let fullText = "";
  let node = walker.nextNode() as Text | null;
  while (node) {
    const value = node.textContent ?? "";
    if (value.length > 0) {
      const start = fullText.length;
      fullText += value;
      slices.push({ node, start, end: start + value.length });
    }
    node = walker.nextNode() as Text | null;
  }
  return { text: fullText, slices };
}

function wrapRange(range: Range): HTMLElement {
  const mark = document.createElement("mark");
  mark.dataset.citationHighlight = "true";
  mark.className = "rounded bg-yellow-300 px-0.5 ring-1 ring-yellow-500/40";
  try {
    range.surroundContents(mark);
  } catch {
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
  }
  return mark;
}

export function applyCitationHighlight(
  root: HTMLElement,
  slices: TextNodeSlice[],
  matchStart: number,
  matchEnd: number
): HTMLElement | null {
  const targets = slices.filter(
    (slice) => matchStart < slice.end && matchEnd > slice.start
  );
  if (targets.length === 0) return null;

  let firstMark: HTMLElement | null = null;
  for (let i = targets.length - 1; i >= 0; i -= 1) {
    const target = targets[i];
    const startOffset = Math.max(0, matchStart - target.start);
    const endOffset = Math.min(
      target.end - target.start,
      matchEnd - target.start
    );
    if (startOffset >= endOffset) continue;
    const range = document.createRange();
    range.setStart(target.node, startOffset);
    range.setEnd(target.node, endOffset);
    const mark = wrapRange(range);
    firstMark ??= mark;
  }

  if (firstMark) {
    firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return firstMark;
}

export function highlightCitationInElement(
  root: HTMLElement,
  phrases: string[]
): boolean {
  for (const phrase of phrases) {
    clearHighlights(root);
    const { text, slices } = collectTextNodeSlices(root);
    const range = findCitationRange(text, phrase);
    if (!range) continue;
    const mark = applyCitationHighlight(root, slices, range[0], range[1]);
    if (mark) return true;
  }

  clearHighlights(root);
  return false;
}
