import { redirect } from "next/navigation";

export default async function LegacyCustomComparePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const params = new URLSearchParams({ mode: "cross" });
  for (const key of ["category", "device1", "device2", "device3"]) {
    const value = query[key];
    if (typeof value === "string") params.set(key, value);
  }
  redirect(`/compare?${params.toString()}`);
}
