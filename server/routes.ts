import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Audio editor API is running" });
  });

  // Project export/import endpoints (optional for future use)
  app.post("/api/projects/export", async (req, res) => {
    try {
      // This could be used for project export functionality
      const projectData = req.body;
      const blob = JSON.stringify(projectData, null, 2);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="project.json"');
      res.send(blob);
    } catch (error) {
      res.status(500).json({ message: "Failed to export project" });
    }
  });

  app.post("/api/projects/import", async (req, res) => {
    try {
      // This could be used for project import functionality
      const projectData = req.body;
      res.json({ message: "Project imported successfully", data: projectData });
    } catch (error) {
      res.status(500).json({ message: "Failed to import project" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
