# Deploy Preflight

Catch missing environment variables, build artifacts and invalid endpoints before a deployment starts.

A small Node.js CLI for local workflows and CI. No account, hosted service or production dependencies. HTTP requests are opt-in.

## Try it locally

Requires Node.js 24 or later. This project is not published on npm yet.

```sh
npm ci
npm test
npm pack
npm install --global ./deploy-preflight-0.1.0.tgz
deploy-preflight --help
```

Create `preflight.config.json` in your project:

```json
{
  "requiredEnv": ["DATABASE_URL", "API_BASE_URL"],
  "requiredFiles": ["package.json", "dist/index.html"],
  "urls": [
    {
      "name": "API health",
      "env": "API_BASE_URL",
      "path": "/health",
      "expectedStatus": 200,
      "timeoutMs": 5000
    }
  ]
}
```

```sh
deploy-preflight check
deploy-preflight check --env-file .env.local --json
deploy-preflight check --probe-urls
```

When running the compiled script directly, use `node -- dist/cli.js check`. The `--` prevents Node from consuming the CLI's `--env-file` option.

## Configuration

All three top-level arrays are optional and default to empty arrays. An empty configuration passes with zero checks. Unknown fields and invalid types are rejected.

| Field | Meaning |
| --- | --- |
| `requiredEnv` | Nonempty variable names. Missing, empty and whitespace-only values fail. |
| `requiredFiles` | Paths relative to the configuration directory; each must be a readable regular file. Absolute paths are accepted. |
| `urls[].name` | Human label used in reports. |
| `urls[].url` or `urls[].env` | Exactly one source: a literal URL or an environment variable name. |
| `urls[].path` | Optional relative URL reference resolved against the source; cannot change its origin. |
| `urls[].expectedStatus` | Integer 100–599; default 200. |
| `urls[].timeoutMs` | Integer 100–30000; default 5000, shared across all redirect hops. |

URLs must use HTTP or HTTPS and must not include a username or password. Without `--probe-urls`, only URL syntax is checked; a passing result does not mean the server is reachable. With the option, GET requests follow up to three redirects, validate every target and compare the final status. Response bodies are cancelled without being read.

## Options and exit codes

| Option | Meaning |
| --- | --- |
| `--config <file>` | Configuration file; default `preflight.config.json` in the working directory. |
| `--env-file <file>` | Explicit dotenv file relative to the working directory; never autodiscovered. |
| `--probe-urls` | Enable HTTP GET probes. |
| `--json` | Emit one JSON report to stdout, including errors. |
| `--help` / `--version` | Show help or version without loading configuration. |

Exit **0** means all checks pass; **1** means at least one check failed; **2** means invalid arguments, unreadable/invalid configuration, environment file errors or an internal error. Duplicate flags are rejected.

Process environment values override the explicit env file, including empty values. Names are case-insensitive on Windows and case-sensitive elsewhere. Loading a file does not modify the process environment. Parsing uses Node's native dotenv parser.

```json
{"passed":false,"results":[{"kind":"env","name":"DATABASE_URL","passed":false,"code":"ENV_MISSING"}]}
```

Invalid configuration produces `{"passed":false,"error":{"code":"CONFIG_INVALID"}}`.

## Privacy and limits

Reports show declared variable names, file paths and URL labels. They omit resolved variable values, URLs, response headers, response bodies and raw exceptions. Keep secrets out of labels and declared file paths: those identifiers are intentionally visible. Configuration files should use `env` sources for sensitive URLs.

Probes can access any configured HTTP/HTTPS destination, including internal services, and redirects can change origin. Only use trusted configuration and endpoints intended for GET requests. There is no authentication-header support, deployment execution, automatic repair or service monitoring. File checks follow symlinks and describe accessibility at check time.

## Runnable example

The included example checks `PREFLIGHT_EXAMPLE` and the repository README:

```sh
# Exit 1: variable missing
node -- dist/cli.js check --config examples/preflight.config.json --json
# Exit 0: value loaded explicitly
node -- dist/cli.js check --config examples/preflight.config.json --env-file examples/.env.example --json
```

See `examples/github-actions.yml` for the same fail-then-pass demonstration. The project workflow runs build, tests, installed-package smoke tests and package inspection on Windows and Linux with Node 24. Remote CI results require a pushed repository.

## Development

```sh
npm ci
npm test
npm run build
npm audit
npm pack --dry-run
```

Tests use real temporary files, subprocesses and local HTTP servers; HTTP tests do not call external services. Permission denial is exercised on platforms where it can be reproduced. Packaging tests install a local tarball without publishing it.

MIT © Enzo Bellussi.
