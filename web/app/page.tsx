const samplePayload = {
  principalUsd: 250000,
  edgeBps: 38,
  flashLoanFeeBps: 9,
  slippageBps: 9,
  gasUnits: 780000,
  gasPriceGwei: 16,
  ethUsd: 3200,
  successProb: 0.71
};

const subscriptionPayload = {
  email: 'subscriber@example.com',
  plan: 'pro'
};

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-badge">Execution API</div>
        <h1>FlashLoan Profit API</h1>
        <p className="hero-copy">
          Use the production-facing API route to estimate net flash-loan profit and expected value from strategy inputs.
        </p>
        <div className="endpoint-row">
          <span className="method">POST</span>
          <code>/api/profit</code>
        </div>
        <div className="endpoint-row">
          <span className="method">POST</span>
          <code>/api/subscribe</code>
        </div>
      </section>

      <section className="content-grid">
        <article className="panel">
          <h2>Request payload</h2>
          <pre>{JSON.stringify(samplePayload, null, 2)}</pre>
        </article>

        <article className="panel">
          <h2>Try it locally</h2>
          <pre>{`curl -X POST http://localhost:3000/api/profit \
  -H 'Content-Type: application/json' \
  -d '${JSON.stringify(samplePayload)}'`}</pre>
        </article>

        <article className="panel">
          <h2>Subscribe and receive reward</h2>
          <pre>{`curl -X POST http://localhost:3000/api/subscribe \
  -H 'Content-Type: application/json' \
  -d '${JSON.stringify(subscriptionPayload)}'`}</pre>
        </article>

        <article className="panel">
          <h2>Reward flow</h2>
          <pre>{`1. POST /api/subscribe with email + plan
2. Receive subscription status and reward object
3. Fetch reward by ID from /api/rewards/{rewardId}`}</pre>
        </article>
      </section>
    </main>
  );
}
