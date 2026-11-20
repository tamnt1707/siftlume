import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@/lib/history';
import { relatedReads } from '@/lib/library-search';

let at = 0;
const entry = (id: string, title: string, text: string, origin?: string): HistoryEntry => ({
  id,
  title,
  text,
  origin,
  kind: 'webpage',
  qa: 0,
  createdAt: ++at,
  updatedAt: at,
});

const HISTORY = [
  entry('ev1', 'Giá xe điện năm 2026', 'Pin rẻ hơn khiến xe điện có giá ngang xe xăng. VinFast và BYD giảm giá, trạm sạc tăng gấp đôi.', 'https://a.example/xe-dien'),
  entry('ev2', 'BYD overtakes Tesla in EV sales', 'Cheaper batteries let BYD undercut Tesla; charging stations doubled in China.', 'https://b.example/byd'),
  entry('ml', 'Học máy cơ bản cho người mới', 'Mạng nơ-ron học từ dữ liệu bằng đạo hàm và lan truyền ngược.', 'https://c.example/ml'),
  entry('q3', 'Acme Q3 earnings', 'Cloud drove 18% revenue growth while hardware kept shrinking.', 'https://d.example/acme'),
  entry('cook', 'Easy pancakes', 'Thin pancakes from flour, eggs and milk in 30 minutes.', 'https://e.example/pancakes'),
  entry('ev-again', 'Giá xe điện năm 2026', 'Pin rẻ hơn, VinFast giảm giá, trạm sạc tăng.', 'https://a.example/xe-dien'),
];

describe('you read about this before', () => {
  it('finds earlier summaries on the same topic, in any wording', () => {
    const now = entry('now', 'Trạm sạc xe điện ở Việt Nam', 'VinFast mở thêm trạm sạc; pin rẻ hơn và BYD vào thị trường khiến giá xe điện giảm.', 'https://f.example/sac');
    const found = relatedReads([...HISTORY, now], 'now').map((e) => e.id);
    expect(found[0]).toBe('ev1');
    expect(found).not.toContain('ml');
    expect(found).not.toContain('cook');
  });

  it('leaves out the same page (What changed covers it) and unrelated reads', () => {
    expect(relatedReads(HISTORY, 'ev1').map((e) => e.id)).not.toContain('ev-again');
    expect(relatedReads(HISTORY, 'cook')).toEqual([]);
    expect(relatedReads(HISTORY, 'missing')).toEqual([]);
    expect(relatedReads([HISTORY[0]!], 'ev1')).toEqual([]);
  });
});
