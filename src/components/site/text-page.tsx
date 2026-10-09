// Renders admin-edited plain text safely: blank lines = paragraphs, short single lines = headings.
export function TextPage({ title, text, updated }: { title: string; text: string; updated?: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-4xl">{title}</h1>
      {updated && <p className="mt-2 text-sm text-charcoal-600">{updated}</p>}
      <div className="prose-site mt-8">
        {blocks.map((b, i) => {
          const [first, ...rest] = b.split('\n');
          const isHeading = first.length < 60 && !/[.:]$/.test(first) && rest.length > 0;
          return isHeading
            ? <section key={i}><h2>{first}</h2><p className="whitespace-pre-line">{rest.join('\n')}</p></section>
            : <p key={i} className="whitespace-pre-line">{b}</p>;
        })}
      </div>
    </div>
  );
}
