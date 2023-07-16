export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const input = query.q;

  const res = await fetch(
    `https://registry.npmjs.org/-/v1/search?text=${input}&size=10`
  );
  const data = await res.json();

  return {
    results: data.objects.map((item: any) => ({
      name: item.package.name,
      version: item.package.version,
      url: `https://cdn.jsdelivr.net/npm/${item.package.name}@${item.package.version}/+esm`,
    })),
  };
});
