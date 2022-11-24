import express from "express";
import path from "node:path";
import {
  unitCharacterGetter,
  unitImageGetter,
  equipmentImageGetter,
  itemImageGetter,
  skillImageGetter,
} from "./middleware/assetsGetter";

const app = express();

const staticOptions = {
  dotfiles: "ignore",
  etag: false,
  extensions: ["png"],
  index: false,
  maxAge: "1d",
  redirect: false,
};

const staticPrefix = path.resolve(process.cwd(), "public", "assets");

const routes = [
  {
    path: "/assets/units/head",
    middleware: unitCharacterGetter,
    staticPath: path.resolve(staticPrefix, "units", "head"),
  },
  {
    path: "/assets/units/full",
    middleware: unitImageGetter,
    staticPath: path.resolve(staticPrefix, "units", "full"),
  },
  {
    path: "/assets/equipment",
    middleware: equipmentImageGetter,
    staticPath: path.resolve(staticPrefix, "equipment"),
  },
  {
    path: "/assets/item",
    middleware: itemImageGetter,
    staticPath: path.resolve(staticPrefix, "item"),
  },
  {
    path: "/assets/skill",
    middleware: skillImageGetter,
    staticPath: path.resolve(staticPrefix, "skill"),
  },
];

routes.forEach((route) => {
  app.use(
    route.path,
    route.middleware,
    express.static(route.staticPath, staticOptions)
  );
});

app.listen(3000, () => {
  console.log("Server started on port 3000", "http://localhost:3000");
});
