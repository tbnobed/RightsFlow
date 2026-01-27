import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Response } from "express";

const isProduction = process.env.NODE_ENV === "production";
const DEFAULT_STORAGE_DIR = isProduction ? "/app/storage" : "./storage";
const STORAGE_DIR = process.env.FILE_STORAGE_DIR || DEFAULT_STORAGE_DIR;
const CONTRACTS_DIR = path.join(STORAGE_DIR, "contracts");

export class FileNotFoundError extends Error {
  constructor() {
    super("File not found");
    this.name = "FileNotFoundError";
    Object.setPrototypeOf(this, FileNotFoundError.prototype);
  }
}

export class FileStorageService {
  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONTRACTS_DIR)) {
      fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
    }
  }

  getStorageDir(): string {
    return STORAGE_DIR;
  }

  getContractsDir(): string {
    return CONTRACTS_DIR;
  }

  generateContractFilePath(originalFilename: string): { fileId: string; filePath: string; relativePath: string } {
    const fileId = randomUUID();
    const ext = path.extname(originalFilename) || ".pdf";
    const filename = `${fileId}${ext}`;
    const filePath = path.join(CONTRACTS_DIR, filename);
    const relativePath = `/files/contracts/${filename}`;
    return { fileId, filePath, relativePath };
  }

  async saveContractFile(buffer: Buffer, originalFilename: string): Promise<{ fileId: string; filePath: string; relativePath: string }> {
    const { fileId, filePath, relativePath } = this.generateContractFilePath(originalFilename);
    await fs.promises.writeFile(filePath, buffer);
    return { fileId, filePath, relativePath };
  }

  async getContractFile(fileId: string): Promise<{ buffer: Buffer; filename: string }> {
    const files = await fs.promises.readdir(CONTRACTS_DIR);
    const file = files.find(f => f.startsWith(fileId));
    
    if (!file) {
      throw new FileNotFoundError();
    }

    const filePath = path.join(CONTRACTS_DIR, file);
    const buffer = await fs.promises.readFile(filePath);
    return { buffer, filename: file };
  }

  async deleteContractFile(fileId: string): Promise<void> {
    const files = await fs.promises.readdir(CONTRACTS_DIR);
    const file = files.find(f => f.startsWith(fileId));
    
    if (file) {
      const filePath = path.join(CONTRACTS_DIR, file);
      await fs.promises.unlink(filePath);
    }
  }

  async downloadContractFile(fileId: string, res: Response): Promise<void> {
    try {
      const { buffer, filename } = await this.getContractFile(fileId);
      const ext = path.extname(filename).toLowerCase();
      
      let contentType = "application/octet-stream";
      if (ext === ".pdf") contentType = "application/pdf";
      else if (ext === ".doc") contentType = "application/msword";
      else if (ext === ".docx") contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      res.set({
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      });

      res.send(buffer);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        res.status(404).json({ error: "File not found" });
      } else {
        console.error("Error downloading file:", error);
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  extractFileIdFromPath(filePath: string): string | null {
    if (!filePath) return null;
    
    if (filePath.startsWith("/files/contracts/")) {
      const filename = filePath.replace("/files/contracts/", "");
      const fileId = filename.split(".")[0];
      return fileId;
    }
    
    if (filePath.startsWith("/objects/")) {
      return filePath.replace("/objects/", "").split("/")[0];
    }
    
    return null;
  }
}

export const fileStorageService = new FileStorageService();
