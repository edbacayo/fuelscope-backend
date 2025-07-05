# FuelScope Backend – Quick Start

A minimal guide for setting up the API on your local machine. Assumes intermediate familiarity with Git, Terminal, and basic Node/Mongo tooling.

---

## 1 · Install prerequisites

| Tool                         | Recommended version | Notes                                            |
| ---------------------------- | ------------------- | ------------------------------------------------ |
| **Node.js**                  | ≥ v18.x             |                                                  |
| **npm**                      | bundled with Node   | v10 + preferred                                  |
| **MongoDB Community Server** | v6.x (or Atlas)     |

---

## 2 · Clone the repository

```bash
# backend only – frontend lives in a separate repo
$ git clone https://github.com/edbacayo/fuelscope-backend.git
```

---

## 3 · Install dependencies

```bash
$ cd fuelscope-backend
$ npm install
```

---

## 4 · Create a local database

Make sure the MongoDB daemon is running locally (e.g. `mongod` or your Docker container). The default connection string used below is:

```
mongodb://localhost:27017/fuelscope
```

---

## 5 · Add a `.env` file

Create *backend/.env* with the following starter values:

```dotenv
NODE_ENV=development          # or "production"
PORT=3000                     # backend port
JWT_SECRET=dev-change-me      # any long random string
MONGO_URI=mongodb://localhost:27017/fuelscope
```

---

