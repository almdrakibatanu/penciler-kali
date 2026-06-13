// Emits a <script type="application/ld+json"> block. Pass a single schema object
// or an array of them. Rendered server-side; safe because we control the data.
export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
