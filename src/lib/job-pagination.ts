// Browse the same ranked snapshot without repeating provider or embedding calls.
export function jobPage<T>(items: T[], requestedPage: number, pageSize = 10) {
 const size = Math.max(1, Math.min(50, Math.floor(pageSize) || 10));
 const pages = Math.max(1, Math.ceil(items.length / size));
 const page = Math.max(1, Math.min(pages, Math.floor(requestedPage) || 1));
 return {items: items.slice((page - 1) * size, page * size), page, pages, total: items.length};
}
