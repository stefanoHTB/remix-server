import * as fs from "node:fs";

import { createRequestHandler } from "@remix-run/express";
import { broadcastDevReady, installGlobals } from "@remix-run/node";
import chokidar from "chokidar";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import sourceMapSupport from "source-map-support";
import cors from "cors";

import remixConfig from "../remix.config.js";

sourceMapSupport.install();
installGlobals();

const BUILD_PATH = `${process.cwd()}/${remixConfig.serverBuildPath}`;
/**
 * @type { import('@remix-run/node').ServerBuild | Promise<import('@remix-run/node').ServerBuild> }
 */
let build = await import(BUILD_PATH);

const app = express();

var corsOptions = {
  origin: ["http://0.0.0.0/", "https://0.0.0.0/", "https://biolab.lol", "https://oroa-development.myshopify.com", "http://0.0.0.0"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());


app.use(compression());

// Uncomment app.enable("trust proxy") if deploying behind a reverse proxy (like HAProxy or nginx)
// https://expressjs.com/en/guide/behind-proxies.html
//app.enable("trust proxy");

// http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
app.disable("x-powered-by");

// Remix fingerprints its assets so we can cache forever.
app.use(
  remixConfig.publicPath,
  express.static(`${process.cwd()}/${remixConfig.assetsBuildDirectory}`, { immutable: true, maxAge: "1y" })
);

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static(`${process.cwd()}/public`, { maxAge: "1h" }));



app.use(morgan("tiny"));



app.get('/api/greeting', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  console.log('hit')
  res.json({ message: 'Hello world' });
});



app.all(
  "*",
  process.env.NODE_ENV === "development"
    ? createDevRequestHandler()
    : createRequestHandler({
        build: build,
        mode: process.env.NODE_ENV,
      })
);


// const port = process.env.PORT || 3000;
const port = 3333;




const server = app.listen(port, async () => {
  console.log(`Express server listening on port ${port}`);
  console.log('wuu')
  console.log('wuu')

  const { address } = server.address();
  console.log(`Server is running at http://${address}`);


  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(build);
  }
});






function createDevRequestHandler() {
  const watcher = chokidar.watch(BUILD_PATH, { ignoreInitial: true });

  watcher.on("all", async () => {
    // 1. purge require cache && load updated server build
    const stat = fs.statSync(BUILD_PATH);
    build = import(BUILD_PATH + "?t=" + stat.mtimeMs);
    // 2. tell dev server that this app server is now ready
    broadcastDevReady(await build);
  });

  return async (req, res, next) => {
    try {
      //
      return createRequestHandler({
        build: await build,
        getLoadContext(req, res) {
          return { req, res };
        },
        mode: "development",
      })(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
