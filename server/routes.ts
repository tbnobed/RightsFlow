import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./auth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertContractSchema, insertRoyaltySchema, availabilityRequestSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication system
  setupAuth(app);

  // Health check endpoint for Docker/monitoring
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const period = (req.query.period as string) || "month";
      const stats = await storage.getDashboardStats(period);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Contract routes
  app.get("/api/contracts", isAuthenticated, async (req, res) => {
    try {
      const { status, territory, search } = req.query;
      const contracts = await storage.getContractsByFilters({
        status: status as string,
        territory: territory as string,
        search: search as string,
      });
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.get("/api/contracts/:id", isAuthenticated, async (req, res) => {
    try {
      const contract = await storage.getContract(req.params.id);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  app.post("/api/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const contractData = insertContractSchema.parse({
        ...req.body,
        createdBy: req.session.userId,
      });
      
      const contract = await storage.createContract(contractData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "Contract Created",
        entityType: "Contract",
        entityId: contract.id,
        newValues: contract,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(201).json(contract);
    } catch (error) {
      console.error("Error creating contract:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create contract" });
    }
  });

  app.put("/api/contracts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const contractId = req.params.id;
      
      const oldContract = await storage.getContract(contractId);
      if (!oldContract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      const contractData = insertContractSchema.partial().parse(req.body);
      const updatedContract = await storage.updateContract(contractId, contractData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "Contract Updated",
        entityType: "Contract",
        entityId: contractId,
        oldValues: oldContract,
        newValues: updatedContract,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json(updatedContract);
    } catch (error) {
      console.error("Error updating contract:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update contract" });
    }
  });

  app.delete("/api/contracts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const contractId = req.params.id;
      
      const contract = await storage.getContract(contractId);
      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }
      
      await storage.deleteContract(contractId);
      
      // Create audit log
      await storage.createAuditLog({
        action: "Contract Deleted",
        entityType: "Contract",
        entityId: contractId,
        oldValues: contract,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ message: "Failed to delete contract" });
    }
  });

  // Rights availability routes
  app.post("/api/availability/check", isAuthenticated, async (req, res) => {
    try {
      const availabilityData = availabilityRequestSchema.parse(req.body);
      
      const result = await storage.checkRightsAvailability(availabilityData);
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: error.errors 
        });
      }
      console.error("Error checking rights availability:", error);
      res.status(500).json({ message: "Failed to check rights availability" });
    }
  });

  // Royalty routes
  app.get("/api/royalties", isAuthenticated, async (req, res) => {
    try {
      const royalties = await storage.getRoyalties();
      res.json(royalties);
    } catch (error) {
      console.error("Error fetching royalties:", error);
      res.status(500).json({ message: "Failed to fetch royalties" });
    }
  });

  app.post("/api/royalties", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const royaltyData = insertRoyaltySchema.parse({
        ...req.body,
        calculatedBy: userId,
      });
      
      const royalty = await storage.createRoyalty(royaltyData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "Royalty Calculated",
        entityType: "Royalty",
        entityId: royalty.id,
        newValues: royalty,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(201).json(royalty);
    } catch (error) {
      console.error("Error creating royalty:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create royalty" });
    }
  });

  app.put("/api/royalties/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const royaltyId = req.params.id;
      
      const oldRoyalty = await storage.getRoyalty(royaltyId);
      if (!oldRoyalty) {
        return res.status(404).json({ message: "Royalty not found" });
      }
      
      const royaltyData = insertRoyaltySchema.partial().parse(req.body);
      const updatedRoyalty = await storage.updateRoyalty(royaltyId, royaltyData);
      
      // Create audit log
      await storage.createAuditLog({
        action: "Royalty Updated",
        entityType: "Royalty",
        entityId: royaltyId,
        oldValues: oldRoyalty,
        newValues: updatedRoyalty,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
      
      res.json(updatedRoyalty);
    } catch (error) {
      console.error("Error updating royalty:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update royalty" });
    }
  });

  // Audit routes
  app.get("/api/audit", isAuthenticated, async (req, res) => {
    try {
      const { action, userId, startDate, endDate } = req.query;
      const auditLogs = await storage.getAuditLogs({
        action: action as string,
        userId: userId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json(auditLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // File upload routes
  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  app.put("/api/contracts/:id/document", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const contractId = req.params.id;
      
      if (!req.body.documentURL) {
        return res.status(400).json({ error: "documentURL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.documentURL,
        {
          owner: userId,
          visibility: "private",
        }
      );

      const updatedContract = await storage.updateContract(contractId, {
        contractDocumentUrl: objectPath,
      });

      res.json({ objectPath, contract: updatedContract });
    } catch (error) {
      console.error("Error setting contract document:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve private objects
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Export routes
  app.get("/api/contracts/export/csv", isAuthenticated, async (req, res) => {
    try {
      const contracts = await storage.getContracts();
      
      // Create CSV content
      const csvHeader = "Partner,Licensee,Licensor,Territory,Platform,Start Date,End Date,Status,Royalty Rate\n";
      const csvContent = contracts
        .map(contract => 
          `"${contract.partner}","${contract.licensee}","${contract.licensor}","${contract.territory}","${contract.platform}","${contract.startDate}","${contract.endDate}","${contract.status}","${contract.royaltyRate || 'N/A'}"`
        )
        .join("\n");
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contracts.csv"');
      res.send(csvHeader + csvContent);
    } catch (error) {
      console.error("Error exporting contracts:", error);
      res.status(500).json({ message: "Failed to export contracts" });
    }
  });

  app.get("/api/royalties/export/csv", isAuthenticated, async (req, res) => {
    try {
      const royalties = await storage.getRoyalties();
      
      // Create CSV content
      const csvHeader = "Partner,Licensee,Period,Revenue,Royalty,Status\n";
      const csvContent = royalties
        .map(royalty => 
          `"${royalty.contract.partner}","${royalty.contract.licensee}","${royalty.reportingPeriod}","${royalty.revenue}","${royalty.royaltyAmount}","${royalty.status}"`
        )
        .join("\n");
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="royalties.csv"');
      res.send(csvHeader + csvContent);
    } catch (error) {
      console.error("Error exporting royalties:", error);
      res.status(500).json({ message: "Failed to export royalties" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
