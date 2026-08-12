import { Request, Response, NextFunction } from "express";
import {
  accessSync,
  constants,
  writeFileSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import axios from "axios";
import { format } from "node:util";
import {
  princessUnitCharacter,
  princessUnitImage,
  princessEquipmentImage,
  princessItemImage,
  princessSkillImage,
} from "../config/assets.config";
import sharp from "sharp";

// Upstream is a third-party mirror; without a timeout a stalled connection
// holds the request (and the client's <img>) open forever.
const UPSTREAM_TIMEOUT_MS = 10000;

export const unitCharacterGetter = unitProcesser({
  urlTemplate: princessUnitCharacter,
  dirPath: path.resolve(process.cwd(), "public", "assets", "units", "head"),
});

export const unitImageGetter = unitProcesser({
  urlTemplate: princessUnitImage,
  dirPath: path.resolve(process.cwd(), "public", "assets", "units", "full"),
});

export const equipmentImageGetter = unitProcesser({
  urlTemplate: princessEquipmentImage,
  dirPath: path.resolve(process.cwd(), "public", "assets", "equipment"),
});

export const itemImageGetter = unitProcesser({
  urlTemplate: princessItemImage,
  dirPath: path.resolve(process.cwd(), "public", "assets", "item"),
});

export const skillImageGetter = unitProcesser({
  urlTemplate: princessSkillImage,
  dirPath: path.resolve(process.cwd(), "public", "assets", "skill"),
});

interface UnitProcesserOptions {
  dirPath: string;
  urlTemplate: string;
}

function unitProcesser(options: UnitProcesserOptions) {
  const { dirPath, urlTemplate } = options;
  return async function (req: Request, res: Response, next: NextFunction) {
    // req.path, not req.url: req.url still carries `?nonce=1`, which would end
    // up in both the cache filename and the upstream id.
    const unitId = retriveUnitIdFromUrl(req.path);
    if (unitId === null) {
      // Not an asset this route can serve. Reject before any upstream request,
      // Sharp work or cache write. 404 rather than 400 so no new public
      // contract appears; a bad basename is simply "no such asset".
      // ponytail: no log here, invalid paths are attacker-controlled log volume.
      sendStatus(res, 404);
      return;
    }

    const filePath = path.resolve(dirPath, `${unitId}.png`);
    if (checkIfFileExists(filePath)) {
      // Cache hit: hand it straight to express.static. Must return, otherwise
      // every cached request re-downloads, re-converts and overwrites the file.
      return next();
    }

    const url = format(urlTemplate, unitId);

    let data: Buffer;
    let upstreamStatus: number | undefined;
    try {
      const result = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: UPSTREAM_TIMEOUT_MS,
      });
      data = result.data;
      upstreamStatus = result.status;
    } catch (err) {
      upstreamStatus = axios.isAxiosError(err) ? err.response?.status : undefined;
      logAssetError("upstream", url, filePath, err, upstreamStatus);
      // Only a confirmed upstream 404 means the asset really does not exist.
      // Timeouts, connection resets and upstream 5xx are gateway failures.
      sendStatus(res, upstreamStatus === 404 ? 404 : 502);
      return;
    }

    let pngBuffer: Buffer;
    try {
      pngBuffer = await sharp(data).toFormat("png").toBuffer();
    } catch (err) {
      // Upstream answered, but not with a decodable image (HTML error page,
      // truncated body, ...) - that is an upstream problem, not a missing file.
      logAssetError("convert", url, filePath, err, upstreamStatus);
      sendStatus(res, 502);
      return;
    }

    try {
      writePNGFile(filePath, pngBuffer);
    } catch (err) {
      logAssetError("write", url, filePath, err, upstreamStatus);
      sendStatus(res, 503);
      return;
    }

    // continue to the next middleware
    if (res.headersSent || res.writableEnded) {
      return;
    }
    return next();
  };
}

// Every route serves numeric-id PNGs from one flat directory, so the only path
// shape they can ever fulfil is "/<digits>.png". Returns null for anything
// else, so the id can never carry a path separator, traversal or query string
// into the cache path / upstream url. Matching the whole path (not just the
// basename) also rejects "/sub/123.png", which express.static could never
// serve anyway.
function retriveUnitIdFromUrl(urlPath: string): string | null {
  const matched = /^\/(\d+)\.png$/.exec(urlPath);
  return matched === null ? null : matched[1];
}

let tempFileSeq = 0;

function writePNGFile(filePath: string, pngBuffer: Buffer) {
  const folderPath = path.dirname(filePath);

  if (!checkFolderAccessible(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }

  // Temp file lives in the target directory so the rename stays inside one
  // filesystem (the mounted public/ cache) - a cross-device rename would fail
  // with EXDEV and is not atomic. pid + seq keeps it unique per process and
  // per request, so concurrent writers never share a temp file.
  const tempPath = `${filePath}.${process.pid}-${Date.now()}-${tempFileSeq++}.tmp`;

  try {
    writeFileSync(tempPath, new Uint8Array(pngBuffer));
    // rename(2) on Linux atomically replaces the destination: readers either
    // see the old complete file or the new complete file, never a partial one.
    // Several first-time requests for the same asset may all rename; last one
    // wins and every response is a complete PNG.
    renameSync(tempPath, filePath);
  } catch (err) {
    try {
      unlinkSync(tempPath);
    } catch (cleanupErr) {
      // Temp file may never have been created; nothing left to clean up.
    }
    throw err;
  }
}

function sendStatus(res: Response, status: number) {
  // Never touch the response twice (e.g. client already aborted).
  if (res.headersSent || res.writableEnded) {
    return;
  }
  res.sendStatus(status);
}

function logAssetError(
  stage: "upstream" | "convert" | "write",
  url: string,
  filePath: string,
  err: unknown,
  upstreamStatus?: number
) {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : undefined;
  const detail =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err);

  console.error(
    `[assets] ${stage} failure url=${url} path=${filePath} upstreamStatus=${
      upstreamStatus ?? "none"
    } code=${code ?? "none"} error=${detail}`
  );
}

function checkIfFileExists(filePath: string): boolean {
  try {
    accessSync(filePath, constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

function checkFolderAccessible(folderPath: string): boolean {
  try {
    accessSync(folderPath, constants.R_OK | constants.W_OK);
    return true;
  } catch (err) {
    return false;
  }
}
