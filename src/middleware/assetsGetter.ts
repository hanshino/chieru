import { Request, Response, NextFunction } from "express";
import { accessSync, constants, writeFileSync, mkdirSync } from "node:fs";
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
    const unitId = retriveUnitIdFromUrl(req.url);

    const filePath = path.resolve(dirPath, `${unitId}.png`);
    if (checkIfFileExists(filePath)) {
      // no need to download the file
      next();
    }
    const url = format(urlTemplate, unitId);
    // download the file
    try {
      const result = await axios.get(url, {
        responseType: "arraybuffer",
      });
      await writePNGFile(filePath, result.data);
    } catch (err) {
      res.sendStatus(404);
      return;
    }

    // continue to the next middleware
    next();
  };
}

function retriveUnitIdFromUrl(url: string): string {
  const urlPieces = url.split("/");
  const unitName = urlPieces.pop() as string;
  const unitId = unitName.replace(".png", "");
  return unitId;
}

async function writePNGFile(filePath: string, data: Buffer) {
  const folderPath = path.dirname(filePath);

  if (!checkFolderAccessible(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }

  const pngBuffer = await sharp(data).toFormat("png").toBuffer();
  writeFileSync(filePath, pngBuffer);
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
