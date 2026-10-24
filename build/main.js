#!/usr/bin/env node

// source/main.ts
import { cwd as getPwd, exit, env as env2, stdout } from "node:process";
import path2 from "node:path";
import chalk4 from "chalk";
import boxen from "boxen";
import * as clipboard from "tinyclip";

// package.json
var package_default = {
  name: "serve",
  version: "14.2.6",
  description: "Static file serving and directory listing",
  keywords: [
    "vercel",
    "serve",
    "micro",
    "http-server"
  ],
  repository: "vercel/serve",
  license: "MIT",
  type: "module",
  bin: {
    serve: "./build/main.js"
  },
  files: [
    "build/"
  ],
  engines: {
    node: ">= 14"
  },
  scripts: {
    develop: "tsx watch ./source/main.ts",
    start: "node ./build/main.js",
    compile: "tsup ./source/main.ts",
    prepare: "node scripts/prepare.mjs",
    "test:tsc": "tsc --project tsconfig.json",
    "test:unit": "vitest run --config config/vitest.ts",
    "test:watch": "vitest watch --config config/vitest.ts",
    test: "pnpm test:tsc && pnpm test:unit",
    "lint:code": "eslint --max-warnings 0 source/**/*.ts",
    "lint:style": "prettier --check --ignore-path .prettierignore .",
    lint: "pnpm lint:code && pnpm lint:style",
    format: "prettier --write --ignore-path .prettierignore .",
    changeset: "changeset",
    "version-packages": "changeset version",
    release: "pnpm compile && changeset publish"
  },
  dependencies: {
    "@zeit/schemas": "2.36.0",
    ajv: "8.18.0",
    arg: "5.0.2",
    boxen: "7.0.0",
    chalk: "5.0.1",
    "chalk-template": "0.4.0",
    compression: "1.8.1",
    "is-port-reachable": "4.0.0",
    minimatch: "10.2.6",
    "serve-handler": "6.1.7",
    tinyclip: "^0.1.12",
    "update-check": "1.5.4"
  },
  devDependencies: {
    "@changesets/cli": "2.29.6",
    "@types/compression": "1.7.2",
    "@types/serve-handler": "6.1.1",
    "@vercel/style-guide": "3.0.0",
    "@vitest/coverage-v8": "2.1.3",
    eslint: "8.19.0",
    got: "12.1.0",
    husky: "8.0.1",
    "lint-staged": "13.0.3",
    prettier: "2.7.1",
    tsup: "8.3.0",
    tsx: "4.19.1",
    typescript: "5.6.3",
    vitest: "2.1.3"
  },
  tsup: {
    target: "esnext",
    format: [
      "esm"
    ],
    outDir: "./build/"
  },
  prettier: "@vercel/style-guide/prettier",
  eslintConfig: {
    extends: [
      "./node_modules/@vercel/style-guide/eslint/node.js",
      "./node_modules/@vercel/style-guide/eslint/typescript.js"
    ],
    parserOptions: {
      project: "tsconfig.json"
    }
  },
  "lint-staged": {
    "*": [
      "prettier --ignore-unknown --write"
    ],
    "source/**/*.ts": [
      "eslint --max-warnings 0 --fix",
      "vitest related --run"
    ],
    tests: [
      "vitest --run"
    ]
  },
  packageManager: "pnpm@10.33.0+sha512.10568bb4a6afb58c9eb3630da90cc9516417abebd3fabbe6739f0ae795728da1491e9db5a544c76ad8eb7570f5c4bb3d6c637b2cb41bfdcdb47fa823c8649319"
};

// source/utilities/promise.ts
import { promisify } from "node:util";
var resolve = async (promiseLike) => {
  try {
    const data = await promiseLike;
    return [void 0, data];
  } catch (error2) {
    return [error2, void 0];
  }
};

// source/utilities/server.ts
import http2 from "node:http";
import https from "node:https";
import { readFile } from "node:fs/promises";
import handler from "serve-handler";
import compression from "compression";
import isPortReachable from "is-port-reachable";
import chalk2 from "chalk";

// source/utilities/http.ts
import { networkInterfaces as getNetworkInterfaces } from "node:os";
var networkInterfaces = getNetworkInterfaces();
var registerCloseListener = (fn) => {
  let run = false;
  const wrapper = () => {
    if (!run) {
      run = true;
      fn();
    }
  };
  process.on("SIGINT", wrapper);
  process.on("SIGTERM", wrapper);
  process.on("exit", wrapper);
};
var getNetworkAddress = () => {
  for (const interfaceDetails of Object.values(networkInterfaces)) {
    if (!interfaceDetails) continue;
    for (const details of interfaceDetails) {
      const { address, family, internal } = details;
      if (family === "IPv4" && !internal) return address;
    }
  }
};

// source/utilities/listing.ts
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { minimatch } from "minimatch";
var collator = new Intl.Collator(void 0, { numeric: true });
var styles = `body { margin: 0; padding: 30px; background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif; -webkit-font-smoothing: antialiased;}main { max-width: 920px;}header { display: flex; justify-content: space-between; flex-wrap: wrap;}h1 { font-size: 18px; font-weight: 500; margin-top: 0; color: #000;}header h1 a { font-size: 18px; font-weight: 500; margin-top: 0; color: #000;}h1 i { font-style: normal;}ul { margin: 0 0 0 -2px; padding: 20px 0 0 0;}ul li { list-style: none; font-size: 14px; display: flex; justify-content: space-between;}a { text-decoration: none;}ul a { color: #000; padding: 10px 5px; margin: 0 -5px; white-space: nowrap; overflow: hidden; display: block; width: 100%; text-overflow: ellipsis;}header a { color: #0076FF; font-size: 11px; font-weight: 400; display: inline-block; line-height: 20px;}svg { height: 13px; vertical-align: text-bottom;}ul a::before { display: inline-block; vertical-align: middle; margin-right: 10px; width: 24px; text-align: center; line-height: 12px;}ul a.file::before { content: url("data:image/svg+xml;utf8,<svg width='15' height='19' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M10 8C8.34 8 7 6.66 7 5V1H3c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V8h-4zM8 5c0 1.1.9 2 2 2h3.59L8 1.41V5zM3 0h5l7 7v9c0 1.66-1.34 3-3 3H3c-1.66 0-3-1.34-3-3V3c0-1.66 1.34-3 3-3z' fill='black'/></svg>");}ul a:hover { text-decoration: underline;}ul a.folder::before { content: url("data:image/svg+xml;utf8,<svg width='20' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'><path d='M18.784 3.87a1.565 1.565 0 0 0-.565-.356V2.426c0-.648-.523-1.171-1.15-1.171H8.996L7.908.25A.89.89 0 0 0 7.302 0H2.094C1.445 0 .944.523.944 1.171v2.3c-.21.085-.398.21-.565.356a1.348 1.348 0 0 0-.377 1.004l.398 9.83C.42 15.393 1.048 16 1.8 16h15.583c.753 0 1.36-.586 1.4-1.339l.398-9.83c.021-.313-.125-.69-.397-.962zM1.843 3.41V1.191c0-.146.104-.272.25-.272H7.26l1.234 1.088c.083.042.167.104.293.104h8.282c.125 0 .25.126.25.272V3.41H1.844zm15.54 11.712H1.78a.47.47 0 0 1-.481-.46l-.397-9.83c0-.147.041-.252.125-.356a.504.504 0 0 1 .377-.147H17.78c.125 0 .272.063.377.147.083.083.125.209.125.334l-.418 9.83c-.021.272-.23.482-.481.482z' fill='black'/></svg>");}::selection { background-color: #79FFE1; color: #000;}::-moz-selection { background-color: #79FFE1; color: #000;}@media (min-width: 768px) { ul {display: flex;flex-wrap: wrap; } ul li {width: 230px;padding-right: 20px; }}@media (min-width: 992px) { body {padding: 45px; } h1, header h1 a {font-size: 15px; } ul li {font-size: 13px;box-sizing: border-box;justify-content: flex-start; }}`;
var encodeHTML = (value) => value.replace(/[&<>"'/]/g, (character) => {
  switch (character) {
    case "&":
      return "&amp;";
    case "<":
      return "&lt;";
    case ">":
      return "&gt;";
    case '"':
      return "&quot;";
    case "'":
      return "&#39;";
    default:
      return "&#47;";
  }
});
var slash = (value) => value.startsWith("/") ? value : `/${value}`;
var matches = (pattern, pathname) => minimatch(path.posix.resolve(pathname), slash(pattern));
var applicable = (pathname, configEntry) => {
  if (typeof configEntry === "boolean") return configEntry;
  if (Array.isArray(configEntry))
    return configEntry.some((source) => matches(source, pathname));
  return true;
};
var canBeListed = (excluded, file) => !excluded.some((source) => matches(source, slash(file)));
var findListingOptions = (pathname, listings) => listings?.find((listing) => matches(listing.source, pathname));
var exists = async (location) => {
  try {
    await lstat(location);
    return true;
  } catch {
    return false;
  }
};
var formatSize = (sizeBytes) => {
  if (sizeBytes <= 0) return "0 B";
  const units = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const exponent = Math.min(
    Math.floor(Math.log10(sizeBytes) / 3),
    units.length - 1
  );
  return `${Math.round(sizeBytes / 1e3 ** exponent)} ${units[exponent] ?? "B"}`;
};
var sortEntries = (entries, sort) => {
  const direction = sort.order === "desc" ? -1 : 1;
  entries.sort((a, b) => {
    if (sort.directoriesFirst && a.type !== b.type)
      return a.type === "folder" ? -1 : 1;
    let comparison = 0;
    if (sort.by === "mtime") comparison = a.mtimeMs - b.mtimeMs;
    else if (sort.by === "size") comparison = a.sizeBytes - b.sizeBytes;
    else comparison = collator.compare(a.name, b.name);
    return comparison * direction;
  });
};
var renderHTML = (files, directory, paths, title) => {
  const pageTitle = title ?? `Files within ${directory}`;
  const heading = title ?? "Index of";
  const breadcrumb = paths.map(
    (subPath) => ` <a href="/${encodeHTML(subPath.url)}">${encodeHTML(
      subPath.name
    )}</a> `
  ).join("");
  const items = files.map(
    (file) => ` <li> <a href="${encodeHTML(file.relative)}" title="${encodeHTML(
      file.title
    )}" class="${file.type}${file.ext ? ` ${file.ext}` : ""}">${encodeHTML(
      file.base
    )}</a> </li> `
  ).join("");
  return `<!DOCTYPE html><html lang="en"> <head> <meta charset="utf-8"> <meta name="viewport" content="width=device-width, initial-scale=1"> <title>${encodeHTML(
    pageTitle
  )}</title> <style>${styles}</style> </head> <body> <main> <header> <h1> <i>${encodeHTML(
    heading
  )}&nbsp;</i> ${breadcrumb} </h1> </header> <ul id="files">${items} </ul></main> </body></html>`;
};
var renderListing = async (request, response, config2) => {
  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") return false;
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname
    );
  } catch {
    return false;
  }
  const current = path.resolve(process.cwd(), config2.public ?? ".");
  const absolutePath = path.join(current, pathname);
  if (absolutePath !== current && !absolutePath.startsWith(`${current}${path.sep}`))
    return false;
  if (config2.redirects?.length) return false;
  const cleanUrl = applicable(pathname, config2.cleanUrls);
  if (cleanUrl && /(?:\.html|\/index)$/.test(pathname)) return false;
  if (typeof config2.trailingSlash === "boolean") {
    const { ext, name } = path.parse(pathname);
    const isTrailed = pathname.endsWith("/");
    if (config2.trailingSlash && !isTrailed && !ext && !name.startsWith("."))
      return false;
    if (!config2.trailingSlash && isTrailed && pathname !== "/") return false;
  }
  if (config2.rewrites?.length && config2.rewrites.some((rewrite) => matches(rewrite.source, pathname)))
    return false;
  if (!applicable(pathname, config2.directoryListing) && !config2.renderSingle)
    return false;
  if (cleanUrl) {
    const trimmed = pathname.replace(/\/+$/, "") || "/";
    if (await exists(path.join(current, trimmed, "index.html"))) return false;
    if (trimmed !== "/" && await exists(`${path.join(current, trimmed)}.html`))
      return false;
  }
  const stats = await lstat(absolutePath).catch(() => null);
  if (!stats || !stats.isDirectory()) return false;
  const names = await readdir(absolutePath).catch(() => null);
  if (!names) return false;
  if (config2.renderSingle && names.length === 1) return false;
  const slashSuffix = config2.trailingSlash === false ? "" : "/";
  const excluded = [".DS_Store", ".git", ...config2.unlisted ?? []];
  const entries = [];
  for (const name of names) {
    if (!canBeListed(excluded, name)) continue;
    const entryStats = await lstat(path.resolve(absolutePath, name)).catch(
      () => null
    );
    if (!entryStats) return false;
    const isDirectory = entryStats.isDirectory();
    const suffix = isDirectory ? slashSuffix : "";
    entries.push({
      name,
      base: `${name}${suffix}`,
      relative: path.posix.join(pathname, `${name}${suffix}`),
      title: `${name}${suffix}`,
      type: isDirectory ? "folder" : "file",
      ext: isDirectory ? "" : path.extname(name).split(".")[1] ?? "txt",
      size: isDirectory ? void 0 : formatSize(entryStats.size),
      sizeBytes: entryStats.size,
      mtimeMs: entryStats.mtimeMs
    });
  }
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const options2 = findListingOptions(normalizedPath, config2.listings);
  const sort = {
    by: "name",
    order: "asc",
    directoriesFirst: false,
    ...options2?.sort
  };
  sortEntries(entries, sort);
  const toRoot = path.relative(current, absolutePath);
  const directory = path.join(path.basename(current), toRoot, slashSuffix);
  const pathParts = directory.split(path.sep).filter(Boolean);
  if (toRoot.length > 0) {
    const parentRelative = path.posix.join(
      "/",
      ...pathParts.slice(1),
      "..",
      slashSuffix
    );
    entries.unshift({
      name: "..",
      base: "..",
      relative: parentRelative,
      title: parentRelative,
      type: "directory",
      ext: "",
      sizeBytes: 0,
      mtimeMs: 0
    });
  }
  const paths = pathParts.map((part, index) => {
    const isLast = index === pathParts.length - 1;
    return {
      name: `${part}${isLast ? slashSuffix : "/"}`,
      url: index === 0 ? "" : `${pathParts.slice(1, index + 1).join("/")}${slashSuffix}`
    };
  });
  const title = options2?.title ?? null;
  const acceptsJSON = request.headers.accept?.includes("application/json") ?? false;
  response.statusCode = 200;
  response.setHeader(
    "Content-Type",
    acceptsJSON ? "application/json; charset=utf-8" : "text/html; charset=utf-8"
  );
  if (acceptsJSON) {
    response.end(
      method === "HEAD" ? void 0 : JSON.stringify({ files: entries, directory, paths, title })
    );
  } else if (method === "HEAD") {
    response.end();
  } else {
    response.end(renderHTML(entries, directory, paths, title));
  }
  return true;
};
var handleDirectoryListing = async (request, response, config2) => {
  try {
    return await renderListing(request, response, config2);
  } catch {
    return false;
  }
};

// source/utilities/logger.ts
import chalk from "chalk";
var http = (...message) => console.info(chalk.bgBlue.bold(" HTTP "), ...message);
var info = (...message) => console.info(chalk.bgMagenta.bold(" INFO "), ...message);
var warn = (...message) => console.error(chalk.bgYellow.bold(" WARN "), ...message);
var error = (...message) => console.error(chalk.bgRed.bold(" ERROR "), ...message);
var log = console.log;
var logger = { http, info, warn, error, log };

// source/utilities/server.ts
var compress = promisify(compression());
var startServer = async (endpoint, config2, args2, previous) => {
  const serverHandler = (request, response) => {
    const run = async () => {
      const requestTime = /* @__PURE__ */ new Date();
      const formattedTime = `${requestTime.toLocaleDateString()} ${requestTime.toLocaleTimeString()}`;
      const ipAddress = request.socket.remoteAddress?.replace("::ffff:", "") ?? "unknown";
      const requestUrl = `${request.method ?? "GET"} ${request.url ?? "/"}`;
      if (!args2["--no-request-logging"])
        logger.http(
          chalk2.dim(formattedTime),
          chalk2.yellow(ipAddress),
          chalk2.cyan(requestUrl)
        );
      if (args2["--cors"]) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "*");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Allow-Private-Network", "true");
      }
      if (!args2["--no-compression"])
        await compress(request, response);
      const handled = await handleDirectoryListing(request, response, config2);
      if (!handled) await handler(request, response, config2);
      const responseTime = Date.now() - requestTime.getTime();
      if (!args2["--no-request-logging"])
        logger.http(
          chalk2.dim(formattedTime),
          chalk2.yellow(ipAddress),
          chalk2[response.statusCode < 400 ? "green" : "red"](
            `Returned ${response.statusCode} in ${responseTime} ms`
          )
        );
    };
    run().catch((error2) => {
      throw error2;
    });
  };
  const sslCert = args2["--ssl-cert"];
  const sslKey = args2["--ssl-key"];
  const sslPass = args2["--ssl-pass"];
  const isPFXFormat = sslCert && /[.](?<extension>pfx|p12)$/.exec(sslCert) !== null;
  const useSsl = sslCert && (sslKey || sslPass || isPFXFormat);
  let serverConfig = {};
  if (useSsl && sslCert && sslKey) {
    serverConfig = {
      key: await readFile(sslKey),
      cert: await readFile(sslCert),
      passphrase: sslPass ? await readFile(sslPass, "utf8") : ""
    };
  } else if (useSsl && sslCert && isPFXFormat) {
    serverConfig = {
      pfx: await readFile(sslCert),
      passphrase: sslPass ? await readFile(sslPass, "utf8") : ""
    };
  }
  const server = useSsl ? https.createServer(serverConfig, serverHandler) : http2.createServer(serverHandler);
  const getServerDetails = () => {
    registerCloseListener(() => server.close());
    const details = server.address();
    let local;
    let network;
    if (typeof details === "string") {
      local = details;
    } else if (typeof details === "object" && details.port) {
      let address;
      if (details.address === "::") address = "localhost";
      else if (details.family === "IPv6") address = `[${details.address}]`;
      else address = details.address;
      const ip = getNetworkAddress();
      const protocol = useSsl ? "https" : "http";
      local = `${protocol}://${address}:${details.port}`;
      network = ip ? `${protocol}://${ip}:${details.port}` : void 0;
    }
    return {
      local,
      network,
      previous
    };
  };
  server.on("error", (error2) => {
    throw new Error(
      `Failed to serve: ${error2.stack?.toString() ?? error2.message}`
    );
  });
  if (typeof endpoint.port === "number" && !isNaN(endpoint.port) && endpoint.port !== 0) {
    const port = endpoint.port;
    const isClosed = await isPortReachable(port, {
      host: endpoint.host ?? "localhost"
    });
    if (isClosed) return startServer({ port: 0 }, config2, args2, port);
  }
  return new Promise((resolve2, _reject) => {
    if (typeof endpoint.port !== "undefined" && typeof endpoint.host === "undefined")
      server.listen(endpoint.port, () => resolve2(getServerDetails()));
    else if (typeof endpoint.port === "undefined" && typeof endpoint.host !== "undefined")
      server.listen(endpoint.host, () => resolve2(getServerDetails()));
    else if (typeof endpoint.port !== "undefined" && typeof endpoint.host !== "undefined")
      server.listen(
        endpoint.port,
        endpoint.host,
        () => resolve2(getServerDetails())
      );
  });
};

// source/utilities/cli.ts
import { parse as parseUrl } from "node:url";
import { env } from "node:process";
import chalk3 from "chalk";
import chalkTemplate from "chalk-template";
import parseArgv from "arg";
import checkForUpdate from "update-check";
var helpText = chalkTemplate`
  {bold.cyan serve} - Static file serving and directory listing

  {bold USAGE}

    {bold $} {cyan serve} --help
    {bold $} {cyan serve} --version
    {bold $} {cyan serve} folder_name
    {bold $} {cyan serve} [-l {underline listen_uri} [-l ...]] [{underline directory}]

    By default, {cyan serve} will listen on {bold 0.0.0.0:3000} and serve the
    current working directory on that address.

    Specifying a single {bold --listen} argument will overwrite the default, not supplement it.

  {bold OPTIONS}

    --help                              Shows this help message

    -v, --version                       Displays the current version of serve

    -l, --listen {underline listen_uri}             Specify a URI endpoint on which to listen (see below) -
                                        more than one may be specified to listen in multiple places

    -p                                  Specify custom port

    -s, --single                        Rewrite all not-found requests to \`index.html\`

    -d, --debug                         Show debugging information

    -c, --config                        Specify custom path to \`serve.json\`

    -L, --no-request-logging            Do not log any request information to the console.

    -C, --cors                          Enable CORS, sets \`Access-Control-Allow-Origin\` to \`*\`

    -n, --no-clipboard                  Do not copy the local address to the clipboard

    -u, --no-compression                Do not compress files

    --no-etag                           Send \`Last-Modified\` header instead of \`ETag\`

    -S, --symlinks                      Resolve symlinks instead of showing 404 errors
    
    --ssl-cert                          Optional path to an SSL/TLS certificate to serve with HTTPS
                                        {grey Supported formats: PEM (default) and PKCS12 (PFX)}
    
    --ssl-key                           Optional path to the SSL/TLS certificate\'s private key
                                        {grey Applicable only for PEM certificates}

    --ssl-pass                          Optional path to the SSL/TLS certificate\'s passphrase

    --no-port-switching                 Do not open a port other than the one specified when it\'s taken.

  {bold ENDPOINTS}

    Listen endpoints (specified by the {bold --listen} or {bold -l} options above) instruct {cyan serve}
    to listen on one or more interfaces/ports, UNIX domain sockets, or Windows named pipes.

    For TCP ports on hostname "localhost":

      {bold $} {cyan serve} -l {underline 1234}

    For TCP (traditional host/port) endpoints:

      {bold $} {cyan serve} -l tcp://{underline hostname}:{underline 1234}

    For UNIX domain socket endpoints:

      {bold $} {cyan serve} -l unix:{underline /path/to/socket.sock}

    For Windows named pipe endpoints:

      {bold $} {cyan serve} -l pipe:\\\\.\\pipe\\{underline PipeName}
`;
var getHelpText = () => helpText;
var parseEndpoint = (uriOrPort) => {
  if (!isNaN(Number(uriOrPort))) return { port: Number(uriOrPort) };
  const endpoint = uriOrPort;
  const url = parseUrl(endpoint);
  switch (url.protocol) {
    case "pipe:": {
      const pipe = endpoint.replace(/^pipe:/, "");
      if (!pipe.startsWith("\\\\.\\"))
        throw new Error(`Invalid Windows named pipe endpoint: ${endpoint}`);
      return { host: pipe };
    }
    case "unix:":
      if (!url.pathname)
        throw new Error(`Invalid UNIX domain socket endpoint: ${endpoint}`);
      return { host: url.pathname };
    case "tcp:":
      url.port = url.port ?? "3000";
      url.hostname = url.hostname ?? "localhost";
      return {
        port: Number(url.port),
        host: url.hostname
      };
    default:
      throw new Error(
        `Unknown --listen endpoint scheme (protocol): ${url.protocol ?? "undefined"}`
      );
  }
};
var options = {
  "--help": Boolean,
  "--version": Boolean,
  "--listen": [parseEndpoint],
  "--single": Boolean,
  "--debug": Boolean,
  "--config": String,
  "--no-clipboard": Boolean,
  "--no-compression": Boolean,
  "--no-etag": Boolean,
  "--symlinks": Boolean,
  "--cors": Boolean,
  "--no-port-switching": Boolean,
  "--ssl-cert": String,
  "--ssl-key": String,
  "--ssl-pass": String,
  "--no-request-logging": Boolean,
  // A list of aliases for the above options.
  "-h": "--help",
  "-v": "--version",
  "-l": "--listen",
  "-s": "--single",
  "-d": "--debug",
  "-c": "--config",
  "-n": "--no-clipboard",
  "-u": "--no-compression",
  "-S": "--symlinks",
  "-C": "--cors",
  "-L": "--no-request-logging",
  // The `-p` option is deprecated and is kept only for backwards-compatibility.
  "-p": "--listen"
};
var parseArguments = () => parseArgv(options);
var checkForUpdates = async (manifest) => {
  if (env.NO_UPDATE_CHECK) return;
  const [error2, update] = await resolve(checkForUpdate(manifest));
  if (error2) throw error2;
  if (!update) return;
  logger.log(
    chalk3.bgRed.white(" UPDATE "),
    `The latest version of \`serve\` is ${update.latest}`
  );
};

// source/utilities/config.ts
import {
  resolve as resolvePath,
  relative as resolveRelativePath
} from "node:path";
import { readFile as readFile2 } from "node:fs/promises";
import Ajv from "ajv";
import schema from "@zeit/schemas/deployment/config-static.js";
var loadConfiguration = async (presentDirectory2, directoryToServe2, args2) => {
  const files = ["serve.json", "now.json", "package.json"];
  if (args2["--config"]) files.unshift(args2["--config"]);
  const config2 = {};
  for (const file of files) {
    const location = resolvePath(directoryToServe2, file);
    const [error2, rawContents] = await resolve(
      readFile2(location, "utf8")
    );
    if (error2) {
      if (error2.code === "ENOENT" && file !== args2["--config"]) continue;
      else
        throw new Error(
          `Could not read configuration from file ${location}: ${error2.message}`
        );
    }
    let parsedJson;
    try {
      parsedJson = JSON.parse(rawContents);
      if (typeof parsedJson !== "object")
        throw new Error("configuration is not an object");
    } catch (parserError) {
      throw new Error(
        `Could not parse ${location} as JSON: ${parserError.message}`
      );
    }
    if (file === "now.json") {
      parsedJson = parsedJson;
      parsedJson = parsedJson.now.static;
    } else if (file === "package.json") {
      parsedJson = parsedJson;
      parsedJson = parsedJson.static;
    }
    if (!parsedJson) continue;
    Object.assign(config2, parsedJson);
    if (file === "now.json" || file === "package.json")
      logger.warn(
        "The config files `now.json` and `package.json` are deprecated. Please use `serve.json`."
      );
    break;
  }
  if (directoryToServe2) {
    const staticDirectory = config2.public;
    config2.public = resolveRelativePath(
      presentDirectory2,
      staticDirectory ? resolvePath(directoryToServe2, staticDirectory) : directoryToServe2
    );
  }
  const listings = config2.listings;
  const hasListings = listings !== void 0;
  if (hasListings) delete config2.listings;
  if (Object.keys(config2).length !== 0) {
    const ajv = new Ajv({ allowUnionTypes: true });
    const validate = ajv.compile(schema);
    if (!validate(config2) && validate.errors) {
      const defaultMessage = "The configuration you provided is invalid:";
      const error2 = validate.errors[0];
      throw new Error(
        `${defaultMessage}
${error2.message ?? ""}
${JSON.stringify(
          error2.params
        )}`
      );
    }
  }
  if (hasListings) {
    const listingsSchema = {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source"],
        properties: {
          source: { type: "string", minLength: 1 },
          title: { type: "string", minLength: 1 },
          sort: {
            type: "object",
            additionalProperties: false,
            properties: {
              by: { enum: ["name", "mtime", "size"] },
              order: { enum: ["asc", "desc"] },
              directoriesFirst: { type: "boolean" }
            }
          }
        }
      }
    };
    const ajv = new Ajv({ allowUnionTypes: true });
    const validate = ajv.compile(listingsSchema);
    if (!validate(listings) && validate.errors) {
      const defaultMessage = "The `listings` configuration you provided is invalid:";
      const error2 = validate.errors[0];
      throw new Error(
        `${defaultMessage}
${error2.message ?? ""}
${JSON.stringify(
          error2.params
        )}`
      );
    }
    config2.listings = listings;
  }
  config2.etag = !args2["--no-etag"];
  config2.symlinks = args2["--symlinks"] || config2.symlinks;
  return config2;
};

// source/main.ts
var [parseError, args] = await resolve(parseArguments());
if (parseError || !args) {
  logger.error(parseError.message);
  exit(1);
}
var [updateError] = await resolve(checkForUpdates(package_default));
if (updateError) {
  const suffix = args["--debug"] ? ":" : " (use `--debug` to see full error)";
  logger.warn(`Checking for updates failed${suffix}`);
  if (args["--debug"]) logger.error(updateError.message);
}
if (args["--version"]) {
  logger.log(package_default.version);
  exit(0);
}
if (args["--help"]) {
  logger.log(getHelpText());
  exit(0);
}
if (!args["--listen"])
  args["--listen"] = [{ port: parseInt(env2.PORT ?? "3000", 10) }];
if (args._.length > 1) {
  logger.error("Please provide one path argument at maximum");
  exit(1);
}
var presentDirectory = getPwd();
var directoryToServe = args._[0] ? path2.resolve(args._[0]) : presentDirectory;
var [configError, config] = await resolve(
  loadConfiguration(presentDirectory, directoryToServe, args)
);
if (configError || !config) {
  logger.error(configError.message);
  exit(1);
}
if (args["--single"]) {
  const { rewrites } = config;
  const existingRewrites = Array.isArray(rewrites) ? rewrites : [];
  config.rewrites = [
    {
      source: "**",
      destination: "/index.html"
    },
    ...existingRewrites
  ];
}
for (const endpoint of args["--listen"]) {
  const { local, network, previous } = await startServer(
    endpoint,
    config,
    args
  );
  const copyAddress = !args["--no-clipboard"];
  if (!stdout.isTTY || env2.NODE_ENV === "production") {
    const suffix = local ? ` at ${local}` : "";
    logger.info(`Accepting connections${suffix}`);
    continue;
  }
  let message = chalk4.green("Serving!");
  if (local) {
    const prefix = network ? "- " : "";
    const space = network ? "    " : "  ";
    message += `

${chalk4.bold(`${prefix}Local:`)}${space}${local}`;
  }
  if (network) message += `
${chalk4.bold("- Network:")}  ${network}`;
  if (previous)
    message += chalk4.red(
      `

This port was picked because ${chalk4.underline(
        previous.toString()
      )} is in use.`
    );
  if (copyAddress && local) {
    try {
      await clipboard.writeText(local);
      message += `

${chalk4.grey("Copied local address to clipboard!")}`;
    } catch (error2) {
      logger.error(
        `Cannot copy server address to clipboard: ${error2.message}.`
      );
    }
  }
  logger.log(
    boxen(message, {
      padding: 1,
      borderColor: "green",
      margin: 1
    })
  );
}
registerCloseListener(() => {
  logger.log();
  logger.info("Gracefully shutting down. Please wait...");
  process.on("SIGINT", () => {
    logger.log();
    logger.warn("Force-closing all open sockets...");
    exit(0);
  });
});
