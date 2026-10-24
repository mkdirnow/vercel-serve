// tests/listing.test.ts
// Tests for the directory listing renderer.

import { utimes } from 'node:fs/promises';
import { beforeAll, describe, test, expect } from 'vitest';
import { extend as createFetch } from 'got';

import { loadConfiguration } from '../source/utilities/config.js';
import { startServer } from '../source/utilities/server.js';
import type { ServerAddress } from '../source/types.js';

// The path to the fixtures for this test file.
const fixture = 'tests/__fixtures__/listing/';
// The configuration from the fixture.
const config = await loadConfiguration(process.cwd(), fixture, {});
// A `fetch` instance to make requests to the server.
const fetch = createFetch({ throwHttpErrors: false });

// The address of the server shared by all tests.
let address: ServerAddress;

const decodeHTML = (value: string): string =>
  value
    .replaceAll('&#47;', '/')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

// Returns the link targets of a rendered listing, in order.
const listHrefs = (body: string): string[] => {
  const files = body.split('<ul id="files">')[1]?.split('</ul>')[0] ?? '';
  return [...files.matchAll(/href="([^"]+)"/g)].map((match) =>
    decodeHTML(match[1]!),
  );
};

describe('utilities/listing', () => {
  beforeAll(async () => {
    address = await startServer({ port: 3030 }, config, {});

    // Set modification times explicitly, since git doesn't preserve them.
    const now = Date.now();
    const ages = new Map([
      ['media/old.txt', 3000],
      ['media/mid.txt', 2000],
      ['media/new.txt', 1000],
      ['media/sub', 500],
    ]);

    for (const [file, age] of ages) {
      const date = new Date(now - age);
      // eslint-disable-next-line no-await-in-loop
      await utimes(`${fixture}${file}`, date, date);
    }
  });

  // Make sure an unconfigured directory is listed with the default title and
  // in ascending name order.
  test('render default listing', async () => {
    const response = await fetch(address.local!);
    expect(response.ok);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<title>Files within listing&#47;</title>');
    expect(response.body).toContain('<i>Index of&nbsp;</i>');

    expect(listHrefs(response.body)).toEqual([
      '/docs/',
      '/hello.txt',
      '/media/',
      '/plain/',
      '/serve.json',
      '/sizes/',
    ]);
  });

  // Make sure a custom title replaces both the `<title>` tag and the
  // "Index of" prefix of the heading.
  test('apply custom title', async () => {
    const response = await fetch(`${address.local}/docs/`);
    expect(response.ok);
    expect(response.body).toContain('<title>Docs Center</title>');
    expect(response.body).toContain('<i>Docs Center&nbsp;</i>');
    // The breadcrumb navigation is still present.
    expect(response.body).toContain('<a href="/">listing&#47;</a>');
  });

  // Make sure `sort` with `by: "name"` and `order: "desc"` is applied.
  test('sort by name in descending order', async () => {
    const response = await fetch(`${address.local}/docs/`);
    expect(response.ok);

    expect(listHrefs(response.body)).toEqual([
      '/',
      '/docs/zdir/',
      '/docs/c.txt',
      '/docs/b.txt',
      '/docs/adir/',
      '/docs/a.txt',
    ]);
  });

  // Make sure `sort` with `by: "mtime"` and `directoriesFirst` is applied.
  test('sort by modification time with directories first', async () => {
    const response = await fetch(`${address.local}/media/`);
    expect(response.ok);

    expect(listHrefs(response.body)).toEqual([
      '/',
      '/media/sub/',
      '/media/new.txt',
      '/media/mid.txt',
      '/media/old.txt',
    ]);
  });

  // Make sure `sort` with `by: "size"` is applied.
  test('sort by size in descending order', async () => {
    const response = await fetch(`${address.local}/sizes/`);
    expect(response.ok);

    expect(listHrefs(response.body)).toEqual([
      '/',
      '/sizes/big.txt',
      '/sizes/mid.txt',
      '/sizes/tiny.txt',
    ]);
  });

  // Make sure directories without a matching `listings` entry are sorted by
  // name in ascending order.
  test('sort by name in ascending order by default', async () => {
    const response = await fetch(`${address.local}/plain/`);
    expect(response.ok);

    expect(listHrefs(response.body)).toEqual([
      '/',
      '/plain/a.txt',
      '/plain/b.txt',
      '/plain/cdir/',
    ]);
  });

  // Make sure regular files are still served by `serve-handler`.
  test('serve regular files', async () => {
    const response = await fetch(`${address.local}/hello.txt`);
    expect(response.ok);
    expect(response.body).toBe('hello listing');
  });

  // Make sure JSON listings are sorted and expose the custom title.
  test('render sorted JSON listing', async () => {
    const response = await fetch(`${address.local}/docs/`, {
      headers: { accept: 'application/json' },
    });
    expect(response.ok);
    expect(response.headers['content-type']).toContain('application/json');

    const spec = JSON.parse(response.body);
    expect(spec.title).toBe('Docs Center');
    expect(spec.directory).toBe('listing/docs/');
    expect(spec.files.map((file: { base: string }) => file.base)).toEqual([
      '..',
      'zdir/',
      'c.txt',
      'b.txt',
      'adir/',
      'a.txt',
    ]);
  });
});
