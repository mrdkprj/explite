import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { Dirent, IPC } from "./ipc";
import { path } from "./path";
import { MIME_TYPE, SEPARATOR } from "./constants";

const REGULAR_TYPES = [".ts", ".json", ".mjs", ".cjs"];
const ipc = new IPC("View");

class Util {
    async exists(target: string | undefined | null, createIfNotFound = false) {
        if (!target) return false;

        const result = await ipc.invoke("exists", target);

        if (result == false && createIfNotFound) {
            await ipc.invoke("mkdir", target);
        }

        return result;
    }

    toHash(value: string) {
        let hash = 0;

        if (value.length === 0) return hash;
        for (let i = 0; i < value.length; i++) {
            const chr = value.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }

    getFileType(mimeType: string, extension: string): Mp.FileType {
        if (REGULAR_TYPES.includes(extension)) {
            return "Normal";
        }

        const lower = mimeType.toLowerCase();
        if (lower.includes(MIME_TYPE.Audio)) {
            return "Audio";
        }

        if (lower.includes(MIME_TYPE.Video)) {
            return "Video";
        }

        if (lower.includes(MIME_TYPE.Image)) {
            return "Image";
        }

        if (lower.includes(MIME_TYPE.App)) {
            return "App";
        }

        return "Normal";
    }

    toFile(dirent: Dirent): Mp.MediaFile {
        const fullPath = dirent.full_path;
        const attr = dirent.attributes;
        const encodedPath = path.join(path.dirname(fullPath), encodeURIComponent(path.basename(fullPath)));
        const extension = attr.is_directory ? "ファイルフォルダー" : path.extname(fullPath);

        return {
            id: encodeURIComponent(fullPath) + crypto.randomUUID(),
            fullPath,
            dir: path.dirname(fullPath),
            encName: encodedPath,
            name: decodeURIComponent(encodeURIComponent(path.basename(fullPath))),
            mdate: attr.mtime_ms,
            cdate: attr.birthtime_ms,
            size: Math.ceil(attr.size / 1000),
            extension,
            isFile: attr.is_file,
            fileType: attr.is_directory ? "None" : this.getFileType(dirent.mime_type, extension),
        };
    }

    async toFileFromPath(fullPath: string): Promise<Mp.MediaFile> {
        const attr = await ipc.invoke("stat", fullPath);
        const mimeType = attr.is_directory ? "" : await ipc.invoke("get_mime_type", fullPath);
        const encodedPath = path.join(path.dirname(fullPath), encodeURIComponent(path.basename(fullPath)));
        const extension = attr.is_directory ? "ファイルフォルダー" : path.extname(fullPath);

        return {
            id: encodeURIComponent(fullPath) + crypto.randomUUID(),
            fullPath,
            dir: path.dirname(fullPath),
            encName: encodedPath,
            name: decodeURIComponent(encodeURIComponent(path.basename(fullPath))),
            mdate: attr.mtime_ms,
            cdate: attr.birthtime_ms,
            size: Math.ceil(attr.size / 1000),
            extension,
            isFile: attr.is_file,
            fileType: attr.is_directory ? "None" : this.getFileType(mimeType, extension),
        };
    }

    async updateFile(fullPath: string, currentFile: Mp.MediaFile): Promise<Mp.MediaFile> {
        const attr = await ipc.invoke("stat", fullPath);
        const mimeType = attr.is_directory ? "" : await ipc.invoke("get_mime_type", fullPath);
        const encodedPath = path.join(path.dirname(fullPath), encodeURIComponent(path.basename(fullPath)));
        const extension = attr.is_directory ? "ファイルフォルダー" : path.extname(fullPath);

        return {
            id: currentFile.id,
            fullPath,
            dir: path.dirname(fullPath),
            encName: encodedPath,
            name: decodeURIComponent(encodeURIComponent(path.basename(fullPath))),
            mdate: attr.mtime_ms,
            cdate: attr.birthtime_ms,
            size: Math.ceil(attr.size / 1000),
            extension,
            isFile: attr.is_file,
            fileType: attr.is_directory ? "None" : this.getFileType(mimeType, extension),
        };
    }

    private localCompareName(a: Mp.MediaFile, b: Mp.MediaFile, sortKey: Mp.SortKey) {
        if (!a.isFile && b.isFile) {
            return -1;
        }

        if (a.isFile && !b.isFile) {
            return 1;
        }

        switch (sortKey) {
            case "name":
                return a.name.replace(path.extname(a.name), "").localeCompare(b.name.replace(path.extname(b.name), ""));
            case "extension":
                return a.extension.localeCompare(b.extension);
            case "mdate":
                return a.mdate - b.mdate || a.name.replace(path.extname(a.name), "").localeCompare(b.name.replace(path.extname(b.name), ""));
            case "cdate":
                return a.cdate - b.cdate || a.name.replace(path.extname(a.name), "").localeCompare(b.name.replace(path.extname(b.name), ""));
            case "size":
                return a.size - b.size || a.name.replace(path.extname(a.name), "").localeCompare(b.name.replace(path.extname(b.name), ""));
            case "directory":
                return a.dir.localeCompare(b.dir);
        }
    }

    sort(files: Mp.MediaFile[], asc: boolean, sortKey: Mp.SortKey) {
        if (!files.length) return files;

        return asc ? files.sort((a, b) => this.localCompareName(a, b, sortKey)) : files.sort((a, b) => this.localCompareName(b, a, sortKey));
    }

    async getDriveInfo(): Promise<Mp.DriveInfo[]> {
        const volumes = await ipc.invoke("list_volumes", undefined);
        const drives: Mp.DriveInfo[] = volumes
            .map((volume) => {
                return {
                    label: volume.mount_point.replaceAll(SEPARATOR, ""),
                    path: volume.mount_point,
                    name: volume.volume_label,
                    available: volume.available_units,
                    total: volume.total_units,
                };
            })
            .filter((drive) => drive.label);
        drives.sort((a, b) => a.label.localeCompare(b.label));

        return drives;
    }

    getRootDirectory(fullPath: string) {
        return path.root(fullPath);
    }

    toPhysicalPosition = (bounds: Mp.Bounds) => {
        return new PhysicalPosition(bounds.x, bounds.y);
    };

    toPhysicalSize = (bounds: Mp.Bounds) => {
        return new PhysicalSize(bounds.width, bounds.height);
    };

    toBounds = (position: PhysicalPosition, size: PhysicalSize): Mp.Bounds => {
        return {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        };
    };
}

const util = new Util();

export default util;
