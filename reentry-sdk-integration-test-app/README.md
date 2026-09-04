# Re-entry SDK Integration Test App

This is a deliberately isolated, test-only Next.js consumer for checking the published
`@4xeoz/re-entry-sdk` consent flow against a Re-entry Cloud Receiver.

It intentionally covers only the consent-to-queued-Event path:

```text
button -> signed Manifest + consent session -> Re-entry consent -> Host status confirmation
       -> approved opaque continuation retained in the test server's memory
       -> second button -> signed Event -> Re-entry acceptance (202 / queued)
```

It does not register a WebMCP tool, update application workflow state, launch an Agent, or provide
a fallback path. The in-memory store is only a placeholder for a real Host database and is cleared
when the Next.js process restarts.

## Run locally

```sh
npm install
cp .env.example .env.local
npm run dev
```

Set the values in `.env.local` using the Host origin, Receiver origin, Ed25519 PKCS#8 PEM Host
private key, Host key id, and organization API key from the developer setup. Keep `.env.local`
untracked. The private key and organization API key are read only by server Route Handlers and are
never exposed to the browser. If the PEM is stored on one line, use literal `\n` escapes between
lines.

Open [http://localhost:3000](http://localhost:3000) and select **Sign a test contract**. The SDK
opens the Receiver consent page in a popup. After approval, the Host status route confirms the
Receiver state and stores the opaque continuation in memory. Select **Trigger test Event** to model
the trusted Host business-event handler; the SDK sends one signed Event and displays the Receiver's
`202 / accepted / queued` response.

The Receiver should record a ConsentSession, HostSubjectBinding, and Grant after approval. After
the second button it should also record one Event and one pending Delivery, and the Grant should
have zero remaining runs. A `202` means queued acceptance, not delivery or acknowledgement.

## Verify

```sh
npm test
npm run build
```

The package versions are intentionally exact so this test consumer is reproducible. The app was
scaffolded against Next.js `16.3.4`, React `19.2.8`, and the npm `latest` Re-entry SDK at `0.3.2`.
