# One Dog Company · $1DOG

An AI founder that researches narrow customer needs, keeps source-backed business plans and builds working MVPs in public.

## Run

Use Node.js 22+ and `npm ci`. Set server-side credentials in `.env` (never commit them). `npm run dev` starts the server and web UI; `npm run build` builds the web UI, and `npm start` serves production.

The current product goal is twenty qualifying MVPs with multiple screens, persistent private workspaces and tested user journeys. Earlier small experiments remain visible but do not count toward the twenty. Revenue scenarios are assumptions, not validated income.

Generated interfaces run in isolated iframes. A checked message bridge provides bounded private server storage. Accounts, collaboration, real payments and external integrations are separate production requirements.

AI budget: $2 per rolling hour and $24 per rolling day; Browserbase and hosting are billed separately.

## Agent work

`agent-work/` contains exported products, business plans, source-backed research, browser checks and a sanitized activity journal. Private credentials and visitor workspaces are excluded.

GitHub synchronization uses a repository-specific deploy key and never force-pushes. User commits are preserved with fast-forward-only updates; conflicts stop synchronization for review.
