import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Audio editor API is running" });
  });

  // Transkriptor TTS endpoint
  app.post("/api/tts/generate", async (req, res) => {
    try {
      const apiKey = process.env.TRANSKRIPTOR_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ 
          message: "Klucz API Transkriptor nie został skonfigurowany" 
        });
      }

      const { text, voice_name, emotion, speed_rate = 1.0 } = req.body;

      if (!text || !voice_name) {
        return res.status(400).json({ 
          message: "Brakuje wymaganych parametrów: text, voice_name" 
        });
      }

      console.log("TTS [Transkriptor] Request:", { text: text.substring(0, 50), voice_name, emotion });

      const response = await fetch("https://api.tor.app/developer/text_to_speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          text,
          language: "pl-PL",
          voice_name
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Transkriptor API error:", errorText);
        return res.status(response.status).json({ 
          message: `Błąd API Transkriptor: ${response.statusText}`,
          details: errorText
        });
      }

      const responseData = await response.json();
      console.log("Transkriptor response:", responseData);

      if (!responseData.audioUrl) {
        return res.status(500).json({ 
          message: "API nie zwróciło URL audio" 
        });
      }

      const audioResponse = await fetch(responseData.audioUrl);
      
      if (!audioResponse.ok) {
        return res.status(500).json({ 
          message: "Nie udało się pobrać pliku audio" 
        });
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.byteLength);
      res.send(Buffer.from(audioBuffer));

    } catch (error) {
      console.error("TTS [Transkriptor] generation error:", error);
      res.status(500).json({ 
        message: "Nie udało się wygenerować audio",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // OpenAI TTS endpoint
  app.post("/api/tts/generate/openai", async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ 
          message: "Klucz API OpenAI nie został skonfigurowany. Dodaj OPENAI_API_KEY w ustawieniach." 
        });
      }

      const { text, voice = 'alloy', model = 'tts-1' } = req.body;

      if (!text) {
        return res.status(400).json({ 
          message: "Brakuje wymaganego parametru: text" 
        });
      }

      console.log("TTS [OpenAI] Request:", { text: text.substring(0, 50), voice, model });

      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: "mp3"
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
        console.error("OpenAI API error:", errorData);
        return res.status(response.status).json({ 
          message: `Błąd API OpenAI: ${errorData.error?.message || response.statusText}`
        });
      }

      const audioBuffer = await response.arrayBuffer();
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.byteLength);
      res.send(Buffer.from(audioBuffer));

    } catch (error) {
      console.error("TTS [OpenAI] generation error:", error);
      res.status(500).json({ 
        message: "Nie udało się wygenerować audio przez OpenAI",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
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
