# ChainLens local MVP

Node.js 22+ only. No dependencies to install.

```sh
npm run check
npm start
```

Open http://127.0.0.1:4186. This loopback URL is a local preview, not a public submission URL.

## Optional AI

Without a provider, the UI explicitly shows rules-based explanations. To enable the optional Groq explanation, start the server with `GROQ_API_KEY`; `GROQ_MODEL` optionally overrides the default `openai/gpt-oss-20b`. The `openai/` prefix is the Groq model ID; requests still go only to Groq. Validated explanations are cached for ten minutes by the categorical facts they explain, with reuse labeled.

`ETHEREUM_RPC_URL` overrides public Ethereum RPC fallback. `PORT` defaults to `4186`. Chrome extension origins must be explicitly listed as comma-separated `CHAINLENS_EXTENSION_ORIGINS` values such as `chrome-extension://<extension-id>`; malformed origins are ignored and every other external Origin is rejected. Secrets belong in the server environment only.

## Scope and provenance

- Ethereum mainnet transaction hashes, Etherscan transaction URLs and `eth.blockscout.com` transaction URLs.
- ETH top-level value, receipt Transfer/Approval events with standard ERC-20 layouts, historical token decimals/symbol best effort, receipt execution status and network fee.
- Approval is the setting at the transaction time, never current allowance. Failed transactions never report intended movements as completed.
- Token events and top-level ETH values are observations, not a guarantee of all actual balance changes. No internal ETH tracing, price estimation, NFTs, swap interpretation or intent inference.
- Included blocks and finalized blocks are distinct. Successful receipt status does not prove every user purpose succeeded.
- Examples in `data/examples.json` are stored real RPC responses. Only the explicit example buttons replay them. Normal hash submission requests live data, with a labeled fifteen-second RPC response cache.
- Deterministic code renders amounts, addresses and status. AI receives categorical facts only, adds educational prose, and cannot replace displayed facts. Output restrictions reject digits, addresses and selected contradictions; these checks do not prove complete semantic correctness.

## API

- `GET /api/health` — service, chain, provider configuration; no credentials.
- `GET /api/examples` — example labels, hashes and provenance.
- `POST /api/interpret` with JSON `{ "input": "0x…", "perspective": "0x…", "exampleId": "approval" }`. `perspective` and `exampleId` are optional; example ID must match the stored hash. Returns deterministic facts, evidence, source, finality and explanation mode.

This server binds only to `127.0.0.1`, validates Host and Origin, supports explicit `POST` CORS preflight only for the local preview and configured extension origins, bounds request bodies and concurrent interpretations, and never fetches arbitrary input URLs. Browser text is escaped; raw token metadata never enters the Groq prompt. New deployment would require a separate hosting and production-hardening decision.
