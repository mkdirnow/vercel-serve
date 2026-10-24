// source/utilities/listing.ts
// Renders directory listings with configurable titles and sort orders,
// replacing the built-in listing of `serve-handler`, which only supports
// a fixed title and alphabetical ordering.

import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { minimatch } from 'minimatch';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Configuration, ListingOptions, ListingSort } from '../types.js';

// An entry of a rendered directory listing.
interface ListingEntry {
  // The raw file name.
  name: string;
  // The display name (folders get the trailing slash suffix).
  base: string;
  // The link target, absolute within the site.
  relative: string;
  // The same as `base`, for compatibility with the JSON output.
  title: string;
  type: 'folder' | 'file' | 'directory';
  ext: string;
  // The human-readable size (files only).
  size?: string;
  sizeBytes: number;
  mtimeMs: number;
}

// A breadcrumb item of the listing header.
interface ListingPath {
  name: string;
  url: string;
}

// Natural sort order (`file2` before `file10`).
const collator = new Intl.Collator(undefined, { numeric: true });

// The listing styles, kept in sync with the look of the `serve-handler`
// directory template.
const styles = `body { margin: 0; padding: 30px; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif; -webkit-font-smoothing: antialiased;}main { max-width: 920px;}header { display: flex; justify-content: space-between; flex-wrap: wrap;}h1 { font-size: 18px; font-weight: 500; margin-top: 0; color: #000;}header h1 a { font-size: 18px; font-weight: 500; margin-top: 0; color: #000;}h1 i { font-style: normal;}ul { margin: 0 0 0 -2px; padding: 20px 0 0 0;}ul li { list-style: none; font-size: 14px; display: flex; justify-content: space-between;}a { text-decoration: none;}ul a { color: #000; padding: 10px 5px; margin: 0 -5px; white-space: nowrap; overflow: hidden; display: block; width: 100%; text-overflow: ellipsis;}header a { color: #0076FF; font-size: 11px; font-weight: 400; display: inline-block; line-height: 20px;}svg { height: 13px; vertical-align: text-bottom;}ul a::before { display: inline-block; vertical-align: middle; margin-right: 10px; width: 24px; text-align: center; line-height: 12px;}ul a.file::before { content: url("data:image/svg+xml;utf8,<svg width='15' height='19' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M10 8C8.34 8 7 6.66 7 5V1H3c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V8h-4zM8 5c0 1.1.9 2 2 2h3.59L8 1.41V5zM3 0h5l7 7v9c0 1.66-1.34 3-3 3H3c-1.66 0-3-1.34-3-3V3c0-1.66 1.34-3 3-3z' fill='black'/></svg>");}ul a:hover { text-decoration: underline;}ul a.folder::before { content: url("data:image/svg+xml;utf8,<svg width='20' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M18.784 3.87a1.565 1.565 0 0 0-.565-.356V2.426c0-.648-.523-1.171-1.15-1.171H8.996L7.908.25A.89.89 0 0 0 7.302 0H2.094C1.445 0 .944.523.944 1.171v2.3c-.21.085-.398.21-.565.356a1.348 1.348 0 0 0-.377 1.004l.398 9.83C.42 15.393 1.048 16 1.8 16h15.583c.753 0 1.36-.586 1.4-1.339l.398-9.83c.021-.313-.125-.69-.397-.962zM1.843 3.41V1.191c0-.146.104-.272.25-.272H7.26l1.234 1.088c.083.042.167.104.293.104h8.282c.125 0 .25.126.25.272V3.41H1.844zm15.54 11.712H1.78a.47.47 0 0 1-.481-.46l-.397-9.83c0-.147.041-.252.125-.356a.504.504 0 0 1 .377-.147H17.78c.125 0 .272.063.377.147.083.083.125.209.125.334l-.418 9.83c-.021.272-.23.482-.481.482z' fill='black'/></svg>");}::selection { background-color: #79FFE1; color: #000;}::-moz-selection { background-color: #79FFE1; color: #000;}@media (min-width: 768px) { ul {display: flex;flex-wrap: wrap; } ul li {width: 230px;padding-right: 20px; }}@media (min-width: 992px) { body {padding: 45px; } h1, header h1 a {font-size: 15px; } ul li {font-size: 13px;box-sizing: border-box;justify-content: flex-start; }}`;

const encodeHTML = (value: string): string =>
  value.replace(/[&<>"'/]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return '&#47;';
    }
  });

const slash = (value: string): string =>
  value.startsWith('/') ? value : `/${value}`;

// Matches a path or glob `pattern` against a pathname, following the same
// semantics as `serve-handler` uses for its `headers` and `unlisted` options.
const matches = (pattern: string, pathname: string): boolean =>
  minimatch(path.posix.resolve(pathname), slash(pattern));

const applicable = (
  pathname: string,
  configEntry: boolean | string[] | undefined,
): boolean => {
  if (typeof configEntry === 'boolean') return configEntry;
  if (Array.isArray(configEntry))
    return configEntry.some((source) => matches(source, pathname));

  return true;
};

const canBeListed = (excluded: string[], file: string): boolean =>
  !excluded.some((source) => matches(source, slash(file)));

// Returns the options of the first `listings` entry whose `source` matches
// the pathname (trailing slashes are ignored while matching).
const findListingOptions = (
  pathname: string,
  listings: ListingOptions[] | undefined,
): ListingOptions | undefined =>
  listings?.find((listing) => matches(listing.source, pathname));

const exists = async (location: string): Promise<boolean> => {
  try {
    await lstat(location);
    return true;
  } catch {
    return false;
  }
};

const formatSize = (sizeBytes: number): string => {
  if (sizeBytes <= 0) return '0 B';
  const units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const exponent = Math.min(
    Math.floor(Math.log10(sizeBytes) / 3),
    units.length - 1,
  );
  return `${Math.round(sizeBytes / 1000 ** exponent)} ${
    units[exponent] ?? 'B'
  }`;
};

const sortEntries = (entries: ListingEntry[], sort: ListingSort): void => {
  const direction = sort.order === 'desc' ? -1 : 1;

  entries.sort((a, b) => {
    if (sort.directoriesFirst && a.type !== b.type)
      return a.type === 'folder' ? -1 : 1;

    let comparison = 0;
    if (sort.by === 'mtime') comparison = a.mtimeMs - b.mtimeMs;
    else if (sort.by === 'size') comparison = a.sizeBytes - b.sizeBytes;
    else comparison = collator.compare(a.name, b.name);

    return comparison * direction;
  });
};

const renderHTML = (
  files: ListingEntry[],
  directory: string,
  paths: ListingPath[],
  title: string | null,
): string => {
  const pageTitle = title ?? `Files within ${directory}`;
  const heading = title ?? 'Index of';

  const breadcrumb = paths
    .map(
      (subPath) =>
        ` <a href="/${encodeHTML(subPath.url)}">${encodeHTML(
          subPath.name,
        )}</a> `,
    )
    .join('');

  const items = files
    .map(
      (file) =>
        ` <li> <a href="${encodeHTML(file.relative)}" title="${encodeHTML(
          file.title,
        )}" class="${file.type}${file.ext ? ` ${file.ext}` : ''}">${encodeHTML(
          file.base,
        )}</a> </li> `,
    )
    .join('');

  return `<!DOCTYPE html><html lang="en"> <head> <meta charset="utf-8"> <meta name="viewport" content="width=device-width, initial-scale=1"> <title>${encodeHTML(
    pageTitle,
  )}</title> <style>${styles}</style> </head> <body> <main> <header> <h1> <i>${encodeHTML(
    heading,
  )}&nbsp;</i> ${breadcrumb} </h1> </header> <ul id="files">${items} </ul></main> </body></html>`;
};

const renderListing = async (
  request: IncomingMessage,
  response: ServerResponse,
  config: Partial<Configuration>,
): Promise<boolean> => {
  const method = request.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') return false;

  let pathname: string;
  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? '/', 'http://localhost').pathname,
    );
  } catch {
    return false;
  }

  const current = path.resolve(process.cwd(), config.public ?? '.');
  const absolutePath = path.join(current, pathname);

  // Path traversal — never render anything outside the served directory.
  if (
    absolutePath !== current &&
    !absolutePath.startsWith(`${current}${path.sep}`)
  )
    return false;

  // Every situation in which `serve-handler` would redirect, or resolve the
  // request to something other than a plain directory listing, is left to
  // `serve-handler` itself.
  if (config.redirects?.length) return false;

  const cleanUrl = applicable(pathname, config.cleanUrls);
  if (cleanUrl && /(?:\.html|\/index)$/.test(pathname)) return false;

  if (typeof config.trailingSlash === 'boolean') {
    const { ext, name } = path.parse(pathname);
    const isTrailed = pathname.endsWith('/');

    if (config.trailingSlash && !isTrailed && !ext && !name.startsWith('.'))
      return false;
    if (!config.trailingSlash && isTrailed && pathname !== '/') return false;
  }

  if (
    config.rewrites?.length &&
    config.rewrites.some((rewrite) => matches(rewrite.source, pathname))
  )
    return false;

  if (!applicable(pathname, config.directoryListing) && !config.renderSingle)
    return false;

  if (cleanUrl) {
    // `serve-handler` serves `{path}/index.html` or `{path}.html` instead of
    // rendering a listing when clean URLs are enabled.
    const trimmed = pathname.replace(/\/+$/, '') || '/';
    if (await exists(path.join(current, trimmed, 'index.html'))) return false;
    if (
      trimmed !== '/' &&
      (await exists(`${path.join(current, trimmed)}.html`))
    )
      return false;
  }

  const stats = await lstat(absolutePath).catch(() => null);
  if (!stats || !stats.isDirectory()) return false;

  const names = await readdir(absolutePath).catch(() => null);
  if (!names) return false;
  if (config.renderSingle && names.length === 1) return false;

  const slashSuffix = config.trailingSlash === false ? '' : '/';
  const excluded = ['.DS_Store', '.git', ...(config.unlisted ?? [])];

  const entries: ListingEntry[] = [];
  for (const name of names) {
    if (!canBeListed(excluded, name)) continue;

    // eslint-disable-next-line no-await-in-loop
    const entryStats = await lstat(path.resolve(absolutePath, name)).catch(
      () => null,
    );
    if (!entryStats) return false;

    const isDirectory = entryStats.isDirectory();
    const suffix = isDirectory ? slashSuffix : '';

    entries.push({
      name,
      base: `${name}${suffix}`,
      relative: path.posix.join(pathname, `${name}${suffix}`),
      title: `${name}${suffix}`,
      type: isDirectory ? 'folder' : 'file',
      ext: isDirectory ? '' : path.extname(name).split('.')[1] ?? 'txt',
      size: isDirectory ? undefined : formatSize(entryStats.size),
      sizeBytes: entryStats.size,
      mtimeMs: entryStats.mtimeMs,
    });
  }

  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const options = findListingOptions(normalizedPath, config.listings);
  const sort: ListingSort = {
    by: 'name',
    order: 'asc',
    directoriesFirst: false,
    ...options?.sort,
  };

  sortEntries(entries, sort);

  const toRoot = path.relative(current, absolutePath);
  const directory = path.join(path.basename(current), toRoot, slashSuffix);
  const pathParts = directory.split(path.sep).filter(Boolean);

  if (toRoot.length > 0) {
    const parentRelative = path.posix.join(
      '/',
      ...pathParts.slice(1),
      '..',
      slashSuffix,
    );

    entries.unshift({
      name: '..',
      base: '..',
      relative: parentRelative,
      title: parentRelative,
      type: 'directory',
      ext: '',
      sizeBytes: 0,
      mtimeMs: 0,
    });
  }

  const paths: ListingPath[] = pathParts.map((part, index) => {
    const isLast = index === pathParts.length - 1;

    return {
      name: `${part}${isLast ? slashSuffix : '/'}`,
      url:
        index === 0
          ? ''
          : `${pathParts.slice(1, index + 1).join('/')}${slashSuffix}`,
    };
  });

  const title = options?.title ?? null;
  const acceptsJSON =
    request.headers.accept?.includes('application/json') ?? false;

  response.statusCode = 200;
  response.setHeader(
    'Content-Type',
    acceptsJSON
      ? 'application/json; charset=utf-8'
      : 'text/html; charset=utf-8',
  );

  if (acceptsJSON) {
    response.end(
      method === 'HEAD'
        ? undefined
        : JSON.stringify({ files: entries, directory, paths, title }),
    );
  } else if (method === 'HEAD') {
    response.end();
  } else {
    response.end(renderHTML(entries, directory, paths, title));
  }

  return true;
};

/**
 * Renders the directory listing for a request if it is a plain directory
 * listing that a `listings` configuration (or the default sort order)
 * applies to.
 *
 * @param request - The incoming HTTP request.
 * @param response - The outgoing HTTP response.
 * @param config - The configuration for the `serve-handler` middleware.
 *
 * @returns Whether the request was handled.
 */
export const handleDirectoryListing = async (
  request: IncomingMessage,
  response: ServerResponse,
  config: Partial<Configuration>,
): Promise<boolean> => {
  try {
    return await renderListing(request, response, config);
  } catch {
    // Any unexpected error falls back to `serve-handler`.
    return false;
  }
};
