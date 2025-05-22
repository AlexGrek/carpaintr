# Autolab

## Development

### backend

Run backend:

`cd backend-service-rust`

`cargo run`

Build binary:

`cargo build`

### frontend

App uses Vite + React + Typescript for frontend

Run Vite dev server:

```sh
cd carpaintr-front
npm run dev
```

Frontend server uses proxy for API requests, so backend should be running and listening on port `8080`

# Build

`make all` or `make redeploy`

# Deploy

Create secret as described in the makefile and then run
`make deploy-service`

