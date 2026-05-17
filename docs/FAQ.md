# FAQ

## Are my credentials safe?

Yes. Credentials are stored in browser localStorage and only sent to the local binary on your machine. Nothing is sent to any external server. The source code is public — audit it yourself.

## Why the OS security warning?

The binary is not code-signed. Certificates cost $300–500/year per platform. Since the code is open source, you can build the binary yourself. See [[Setup#os-security-warnings]].

## Can I use this with a team?

Yes, with caveats. Run the binary on a shared machine inside your VPN, and put an auth proxy (Nginx basic auth, Cloudflare Access) in front of it. There is no built-in authentication.

## Why not a cloud version?

A cloud-hosted version would require credentials to pass through a third-party server. That's a poor security trade-off for a database tool. See the [blog post](https://github.com/BunAgents/bun-sql-editor/blob/main/landing/blog/why-local.html) for the full explanation.

## Can I connect to a remote database?

Yes. Enter any hostname or IP in the host field. For databases behind a firewall, use an SSH tunnel:

```bash
ssh -L 5433:db.internal:5432 user@bastion
# then connect to localhost:5433
```

## Does it work offline?

The UI shell is cached by the service worker. Queries require a live connection to the local binary and your database.

## Where is my data stored?

- Connection configs → browser localStorage
- Query history → browser localStorage
- Query results → in-memory only
- Nothing is stored on disk by the binary

## Can I run multiple instances?

```bash
PORT=3001 ./bun-sql-editor &
PORT=3002 ./bun-sql-editor &
```

Each instance has independent localStorage (scoped to the port).

## Does it support SSL?

Yes. Toggle the SSL switch in the connection dialog.

## How do I report a bug?

Open an issue at https://github.com/BunAgents/bun-sql-editor/issues with your OS, database type, and steps to reproduce.
