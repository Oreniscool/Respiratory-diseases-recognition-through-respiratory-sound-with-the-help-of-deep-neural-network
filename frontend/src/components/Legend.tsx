type Item = { label: string; color: string; count?: number };

/** Colour key with labels (and counts): colour is never the only carrier of identity. */
export function Legend({ items }: { items: Item[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm text-ink">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-sm" style={{ background: item.color }} />
          <span>
            {item.label}
            {item.count !== undefined && <b className="tabular ml-1 font-semibold">{item.count}</b>}
          </span>
        </li>
      ))}
    </ul>
  );
}
