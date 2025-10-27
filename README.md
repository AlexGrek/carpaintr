# Autolab

[![Build Status](https://drone.dcommunity.space/api/badges/AlexGrek/carpaintr/status.svg?ref=refs/heads/main)](https://drone.dcommunity.space/AlexGrek/carpaintr)

## Development

### backend

Run backend:

```sh
cd backend-service-rust`
cargo run
```

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
