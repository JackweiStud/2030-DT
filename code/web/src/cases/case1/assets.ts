const urls = import.meta.glob("../../../assets/case1/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
export function asset(name: string): string {
  const url = urls[`../../../assets/case1/${name}`];
  if (!url) throw new Error(`Unknown case1 asset: ${name}`);
  return url;
}
