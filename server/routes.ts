import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { insertAudioFileSchema, insertProjectSchema } from "@shared/schema";

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure uploads directory exists
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }

  // Audio file upload
  app.post("/api/audio/upload", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const { originalname, mimetype, size, path: filePath } = req.file;
      
      // Basic validation for audio files
      if (!mimetype.startsWith('audio/')) {
        fs.unlinkSync(filePath); // Clean up uploaded file
        return res.status(400).json({ message: "File must be an audio file" });
      }

      // TODO: Get actual duration using audio analysis library
      const duration = 0; // Placeholder - should be extracted from audio file

      const audioFileData = {
        name: originalname.split('.')[0],
        originalName: originalname,
        mimeType: mimetype,
        size,
        duration,
        filePath
      };

      const validatedData = insertAudioFileSchema.parse(audioFileData);
      const audioFile = await storage.createAudioFile(validatedData);
      
      res.json(audioFile);
    } catch (error) {
      console.error('Audio upload error:', error);
      res.status(500).json({ message: "Failed to upload audio file" });
    }
  });

  // Get all audio files
  app.get("/api/audio", async (req, res) => {
    try {
      const audioFiles = await storage.getAllAudioFiles();
      res.json(audioFiles);
    } catch (error) {
      res.status(500).json({ message: "Failed to get audio files" });
    }
  });

  // Serve audio files
  app.get("/api/audio/:id/file", async (req, res) => {
    try {
      const audioFile = await storage.getAudioFile(req.params.id);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      const filePath = audioFile.filePath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Audio file not found on disk" });
      }

      res.setHeader('Content-Type', audioFile.mimeType);
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      res.status(500).json({ message: "Failed to serve audio file" });
    }
  });

  // Delete audio file
  app.delete("/api/audio/:id", async (req, res) => {
    try {
      const audioFile = await storage.getAudioFile(req.params.id);
      if (!audioFile) {
        return res.status(404).json({ message: "Audio file not found" });
      }

      // Delete file from disk
      if (fs.existsSync(audioFile.filePath)) {
        fs.unlinkSync(audioFile.filePath);
      }

      const deleted = await storage.deleteAudioFile(req.params.id);
      if (deleted) {
        res.json({ message: "Audio file deleted successfully" });
      } else {
        res.status(404).json({ message: "Audio file not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete audio file" });
    }
  });

  // Project management
  app.post("/api/projects", async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validatedData);
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to get projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to get project" });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.updateProject(req.params.id, validatedData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProject(req.params.id);
      if (deleted) {
        res.json({ message: "Project deleted successfully" });
      } else {
        res.status(404).json({ message: "Project not found" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
