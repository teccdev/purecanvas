import Dexie, { type Table } from "dexie"
import type { AssetRecord, ProjectRecord } from "./types"

export class PureCanvasDB extends Dexie {
  projects!: Table<ProjectRecord, string>
  assets!: Table<AssetRecord, string>

  constructor() {
    super("purecanvas")
    this.version(1).stores({
      projects: "id, updatedAt",
      assets: "id, projectId",
    })
  }
}

export const db = new PureCanvasDB()

export async function createProject(name: string, project: ProjectRecord): Promise<void> {
  await db.projects.put(project)
  if (name) await db.projects.update(project.id, { name })
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction("rw", db.projects, db.assets, async () => {
    await db.projects.delete(id)
    await db.assets.where("projectId").equals(id).delete()
  })
}

export async function putAsset(asset: AssetRecord): Promise<void> {
  await db.assets.put(asset)
}
