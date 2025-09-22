import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { Dirent, FileAttribute, IPCBase } from "./ipc";
import { path } from "./path";
import { ARCHIVE_EXT, LinuxUserRootDir, MIME_TYPE, OS, SEPARATOR, WIN_SPECIAL_FOLDERS, WinUserRootDir } from "./constants";
import { t } from "./translation/useTranslation";

const REGULAR_TYPES = [".ts", ".json", ".mjs", ".cjs"];
const ipc = new IPCBase();
const isWin = navigator.userAgent.includes(OS.windows);

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

    private mayContainSpecialFolder(fullPath: string, attr: FileAttribute) {
        if (isWin && fullPath.startsWith(WinUserRootDir) && attr.is_directory) {
            return true;
        }

        if (!isWin && fullPath.startsWith(LinuxUserRootDir) && attr.is_directory) {
            return true;
        }

        return false;
    }

    private getSpecialFolderType(fullPath: string) {
        if (isWin) {
            const matched = Object.entries(WIN_SPECIAL_FOLDERS).find(([_, reg]) => !!fullPath.match(reg));
            if (matched) {
                return matched[0];
            }
        }
    }

    private getEntityType(attr: FileAttribute): Mp.EntityType {
        if (attr.is_symbolic_link) {
            return attr.is_directory ? "SymlinkFolder" : "SymlinkFile";
        }

        if (attr.is_directory) {
            return "Folder";
        }

        return "File";
    }

    private getFileType(fullPath: string, attr: FileAttribute, mimeType: string, extension: string): Mp.FileType {
        if (this.mayContainSpecialFolder(fullPath, attr)) {
            const specialFolder = this.getSpecialFolderType(fullPath);
            if (specialFolder) {
                return specialFolder as Mp.FileType;
            }
        }

        if (attr.is_directory) {
            return attr.is_hidden ? "HiddenFolder" : "Folder";
        }

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
            if (ARCHIVE_EXT.includes(extension)) return "Zip";
            return "App";
        }

        return "Normal";
    }

    private getExtension(fullPath: string, attr: FileAttribute) {
        if (attr.is_directory) {
            return attr.is_symbolic_link ? t("typeShortcut") : t("typeFolder");
        }

        return attr.is_symbolic_link ? t("typeShortcut") : path.extname(fullPath);
    }

    private getName(fullPath: string) {
        const displayPath = path.extname(fullPath) == ".lnk" ? fullPath.substring(0, fullPath.lastIndexOf(".lnk")) : fullPath;

        return path.basename(displayPath);
    }

    toFile(dirent: Dirent): Mp.MediaFile {
        const fullPath = dirent.full_path;
        const attr = dirent.attributes;
        const extension = this.getExtension(fullPath, attr);
        const entityType = this.getEntityType(attr);
        const fileType = this.getFileType(fullPath, attr, dirent.mime_type, extension);
        const name = this.getName(fullPath);

        return {
            id: encodeURIComponent(fullPath),
            fullPath,
            dir: path.dirname(fullPath),
            uuid: crypto.randomUUID(),
            name,
            mdate: attr.mtime_ms,
            cdate: attr.birthtime_ms,
            size: Math.ceil(attr.size / 1024),
            isFile: attr.is_file,
            extension,
            fileType,
            linkPath: attr.link_path,
            entityType,
        };
    }

    async toFileFromPath(fullPath: string): Promise<Mp.MediaFile> {
        const attr = await ipc.invoke("stat", fullPath);
        let mimeType = "";
        if (!attr.is_directory) {
            mimeType = attr.is_symbolic_link ? await ipc.invoke("get_mime_type", attr.link_path) : await ipc.invoke("get_mime_type", fullPath);
        }
        const extension = this.getExtension(fullPath, attr);
        const entityType = this.getEntityType(attr);
        const fileType = this.getFileType(fullPath, attr, mimeType, extension);
        const name = this.getName(fullPath);

        return {
            id: encodeURIComponent(fullPath),
            fullPath,
            dir: path.dirname(fullPath),
            uuid: crypto.randomUUID(),
            name,
            mdate: attr.mtime_ms,
            cdate: attr.birthtime_ms,
            size: Math.ceil(attr.size / 1024),
            isFile: attr.is_file,
            extension,
            entityType,
            fileType,
            linkPath: attr.link_path,
        };
    }

    toFolder(fullPath: string): Mp.MediaFile {
        return {
            id: encodeURIComponent(fullPath),
            fullPath,
            dir: path.dirname(fullPath),
            uuid: crypto.randomUUID(),
            name: decodeURIComponent(encodeURIComponent(path.basename(fullPath))),
            mdate: 0,
            cdate: 0,
            size: 0,
            extension: "",
            isFile: false,
            entityType: "Folder",
            fileType: "Folder",
            linkPath: "",
        };
    }

    private localCompareName(a: Mp.MediaFile, b: Mp.MediaFile, sortKey: Mp.SortKey) {
        // Treat a shortcut as file
        const aIsFile = a.linkPath ? true : a.isFile;
        const bIsFile = b.linkPath ? true : b.isFile;

        if (!aIsFile && bIsFile) {
            return -1;
        }

        if (aIsFile && !bIsFile) {
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
                    label: navigator.userAgent.includes(OS.windows) ? volume.mount_point.replaceAll(SEPARATOR, "") : volume.mount_point,
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
