export type FileCategory = 'text' | 'code' | 'markdown' | 'image' | 'media' | 'binary';

const ROUTES: [RegExp, FileCategory][] = [
  [/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i, 'image'],
  [/\.(mp3|wav|ogg|aac|flac|mp4|webm|mov)$/i, 'media'],
  [/\.(md|mdx)$/i, 'markdown'],
  [/\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|sh|bash|zsh|json|xml|yaml|yml|css|scss|less|html|htm|toml|ini|cfg|env)$/i, 'code'],
  [/\.(txt|log|csv|tsv)$/i, 'text'],
];

export function getFileCategory(path: string): FileCategory {
  for (const [re, cat] of ROUTES) {
    if (re.test(path)) return cat;
  }
  return 'binary';
}
