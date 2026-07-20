export interface StoryBlock {
  storyLine: string;
  details: string[];
}

// Groups the plain-text story output into blocks: each numbered line starts a
// block; subsequent non-numbered lines (acceptance criteria, scenarios, etc.)
// are its details.
export function parseStoryBlocks(text: string): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  let current: StoryBlock | null = null;
  for (const line of text.split('\n')) {
    const clean = line.trim().replace(/\*\*/g, '');
    if (!clean) continue;
    if (/^(\d+[\.\)])\s/.test(clean)) {
      if (current) blocks.push(current);
      current = { storyLine: clean, details: [] };
    } else if (current) {
      current.details.push(clean);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}
