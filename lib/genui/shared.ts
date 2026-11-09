/** Slots where content blocks may appear: the root Card and any nested container. */
export const CONTENT_SLOTS = ['Card.children', 'SectionItem.content', 'TabItem.content', 'AccordionItem.content'];

/** Props of child nodes that the parent renders itself (it needs all of them at once). */
export const childProps = <T>(nodes: unknown): T[] =>
  (Array.isArray(nodes) ? (nodes as { props?: T }[]) : []).map((n) => n?.props).filter((p): p is T => Boolean(p));
