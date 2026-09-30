function normalizedName(value: string) {
  return value.normalize("NFKC").replace(/[يى]/g, "ی").replace(/ك/g, "ک")
    .replace(/[\u200c\u200d]/g, " ").replace(/[\u064b-\u065f]/g, "")
    .trim().replace(/\s+/g, " ").toLocaleLowerCase("fa-IR");
}

export function rosterPage<T extends { name: string }>(workers: T[], query: string, page: number, pageSize = 10) {
  const search = normalizedName(query);
  const matching = workers.filter(worker => normalizedName(worker.name).includes(search));
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  return {
    items: matching.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    total: matching.length,
    totalPages,
    currentPage,
  };
}
