# docs

Developer documentation site for Konstellation, built with
[Docusaurus](https://docusaurus.io). Public, pre-testnet — most pages are
placeholders until `networks/testnet-1` exists (see `ENGINEERING.md §6.6`
and `STATUS.md` in the org root for what's real vs. stubbed).

## Local development

```bash
npm install
npm start        # serves at http://localhost:3000 with hot reload
```

```bash
npm run build    # static site into build/
npm run serve    # serve the production build locally
```

## Structure

```
docs/
├── docs/
│   ├── quickstart.md
│   ├── rpc-endpoints.md
│   ├── contracts.md
│   ├── run-a-validator.md
│   ├── upgrades.md
│   └── troubleshooting.md
├── src/css/custom.css
├── CODEOWNERS
├── docusaurus.config.js
└── sidebars.js
```
