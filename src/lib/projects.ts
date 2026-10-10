import { db } from "./db";
import { uid } from "./id";
import { useDoc } from "@/store/useDoc";
import { useUI } from "@/store/useUI";
import type { ProjectRecord } from "./types";

const LAST_KEY = "purecanvas-last-project";

export function makeProject(name = "Untitled"): ProjectRecord {
    const now = Date.now();
    return {
        id: uid("proj"),
        name,
        elements: [],
        camera: { x: 0, y: 0, zoom: 1 },
        createdAt: now,
        updatedAt: now,
    };
}

export async function openProject(
    id: string,
): Promise<ProjectRecord | undefined> {
    const record = await db.projects.get(id);
    if (!record) return undefined;
    localStorage.setItem(LAST_KEY, id);
    useUI.getState().clearSelection();
    useUI.getState().setEditingText(null);
    useUI.getState().setTool("select");
    useDoc.getState().setProject({
        projectId: record.id,
        projectName: record.name,
        elements: record.elements,
        camera: record.camera,
    });
    return record;
}

export async function createAndOpenProject(
    name = "Untitled",
): Promise<ProjectRecord> {
    const record = makeProject(name);
    await db.projects.put(record);
    await openProject(record.id);
    return record;
}

export async function renameProject(id: string, name: string): Promise<void> {
    await db.projects.update(id, { name, updatedAt: Date.now() });
    if (useDoc.getState().projectId === id)
        useDoc.getState().setProjectName(name);
}

export async function removeProject(id: string): Promise<void> {
    await db.transaction("rw", db.projects, db.assets, async () => {
        await db.projects.delete(id);
        await db.assets.where("projectId").equals(id).delete();
    });
    if (localStorage.getItem(LAST_KEY) === id)
        localStorage.removeItem(LAST_KEY);
    if (useDoc.getState().projectId === id) {
        const next = await db.projects.orderBy("updatedAt").reverse().first();
        if (next) await openProject(next.id);
        else await createAndOpenProject();
    }
}

export async function bootstrapProject(): Promise<void> {
    const lastId = localStorage.getItem(LAST_KEY);
    if (lastId) {
        const opened = await openProject(lastId);
        if (opened) return;
    }
    const existing = await db.projects.orderBy("updatedAt").reverse().first();
    if (existing) {
        await openProject(existing.id);
        return;
    }
    await createAndOpenProject();
}
