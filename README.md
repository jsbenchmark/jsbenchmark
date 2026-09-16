# JS Benchmark

Look at the [Nuxt 4 documentation](https://nuxt.com/docs/4.x/getting-started/introduction) to
learn more.

## Setup

Make sure to install the dependencies:

```bash
pnpm install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm run dev
```

## Production

Build the application for production:

```bash
pnpm run build
```

Locally preview production build:

```bash
pnpm run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Testing

Run the unit tests:

```bash
pnpm test
```

Install the browsers once, then run the end-to-end tests in Chromium and Firefox:

```bash
pnpm exec playwright install chromium firefox
pnpm test:e2e
```

Use `pnpm test:e2e:ui` to run the Playwright suite interactively.
