import { type AudioFile, type InsertAudioFile, type Project, type InsertProject } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Audio files
  createAudioFile(audioFile: InsertAudioFile): Promise<AudioFile>;
  getAudioFile(id: string): Promise<AudioFile | undefined>;
  getAllAudioFiles(): Promise<AudioFile[]>;
  deleteAudioFile(id: string): Promise<boolean>;
  
  // Projects
  createProject(project: InsertProject): Promise<Project>;
  getProject(id: string): Promise<Project | undefined>;
  getAllProjects(): Promise<Project[]>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private audioFiles: Map<string, AudioFile>;
  private projects: Map<string, Project>;

  constructor() {
    this.audioFiles = new Map();
    this.projects = new Map();
  }

  async createAudioFile(insertAudioFile: InsertAudioFile): Promise<AudioFile> {
    const id = randomUUID();
    const audioFile: AudioFile = { ...insertAudioFile, id };
    this.audioFiles.set(id, audioFile);
    return audioFile;
  }

  async getAudioFile(id: string): Promise<AudioFile | undefined> {
    return this.audioFiles.get(id);
  }

  async getAllAudioFiles(): Promise<AudioFile[]> {
    return Array.from(this.audioFiles.values());
  }

  async deleteAudioFile(id: string): Promise<boolean> {
    return this.audioFiles.delete(id);
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const project: Project = { 
      ...insertProject, 
      id, 
      createdAt: now,
      updatedAt: now 
    };
    this.projects.set(id, project);
    return project;
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async updateProject(id: string, updateData: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject: Project = {
      ...project,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }
}

export const storage = new MemStorage();
