import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useFileTreeStore, FileNode } from '@/stores/useFileTreeStore';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileImage,
  MagnifyingGlass,
  FolderPlus,
  FilePlus,
  Trash,
  PencilSimple,
  CircleNotch,
} from '@phosphor-icons/react';

const FILE_ICONS: Record<string, typeof File> = {
  // Code files
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  rs: FileCode,
  py: FileCode,
  go: FileCode,
  java: FileCode,
  cpp: FileCode,
  c: FileCode,
  // Text files
  md: FileText,
  txt: FileText,
  json: FileText,
  yaml: FileText,
  yml: FileText,
  toml: FileText,
  // Images
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  svg: FileImage,
  webp: FileImage,
};

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext && FILE_ICONS[ext] ? FILE_ICONS[ext] : File;
}

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
}

function FileTreeNode({ node, level, onSelect, onDelete, onRename }: FileTreeNodeProps) {
  const { selectedFile, expandedDirs, toggleDirectory } = useFileTreeStore();
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedFile === node.path;
  const [showActions, setShowActions] = useState(false);

  const Icon = node.type === 'directory'
    ? isExpanded
      ? FolderOpen
      : Folder
    : getFileIcon(node.name);

  const handleClick = () => {
    if (node.type === 'directory') {
      toggleDirectory(node.path);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-[var(--surface-hover)] ${
          isSelected ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : ''
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <Icon
          size={16}
          weight={node.type === 'directory' ? 'fill' : 'regular'}
          className="flex-shrink-0"
        />
        <span className="flex-1 text-sm truncate">{node.name}</span>
        {showActions && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onRename(node.path)}
              className="p-1 hover:bg-[var(--surface)] rounded"
              title="Rename"
            >
              <PencilSimple size={14} />
            </button>
            <button
              onClick={() => onDelete(node.path)}
              className="p-1 hover:bg-[var(--surface)] rounded text-[var(--danger)]"
              title="Delete"
            >
              <Trash size={14} />
            </button>
          </div>
        )}
      </div>
      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree() {
  const {
    rootPath,
    setRootPath,
    files,
    setFiles,
    setSelectedFile,
    searchQuery,
    setSearchQuery,
    isLoading,
    setIsLoading,
  } = useFileTreeStore();

  const [filteredFiles, setFilteredFiles] = useState<FileNode[]>([]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredFiles(files);
      return;
    }

    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .map((node) => {
          if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return node;
          }
          if (node.children) {
            const filteredChildren = filterNodes(node.children);
            if (filteredChildren.length > 0) {
              return { ...node, children: filteredChildren };
            }
          }
          return null;
        })
        .filter((node): node is FileNode => node !== null);
    };

    setFilteredFiles(filterNodes(files));
  }, [files, searchQuery]);

  const loadDirectory = async (path: string) => {
    setIsLoading(true);
    try {
      const nodes = await invoke<FileNode[]>('read_directory', {
        path,
        recursive: true,
      });
      setFiles(nodes);
      setRootPath(path);
    } catch (error) {
      console.error('Failed to load directory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected) {
        await loadDirectory(selected as string);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  };

  const handleSelectFile = (path: string) => {
    setSelectedFile(path);
    // Emit event for code editor to open file
    window.dispatchEvent(new CustomEvent('file-selected', { detail: { path } }));
  };

  const handleDeleteFile = async (path: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
      await invoke('delete_file', { path });
      if (rootPath) {
        await loadDirectory(rootPath);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert(`Failed to delete: ${error}`);
    }
  };

  const handleRenameFile = async (path: string) => {
    const newName = prompt('Enter new name:');
    if (!newName) return;
    
    const newPath = path.replace(/[^/\\]+$/, newName);
    
    try {
      await invoke('rename_file', { oldPath: path, newPath });
      if (rootPath) {
        await loadDirectory(rootPath);
      }
    } catch (error) {
      console.error('Failed to rename file:', error);
      alert(`Failed to rename: ${error}`);
    }
  };

  const handleCreateFile = async () => {
    if (!rootPath) return;
    
    const name = prompt('Enter file name:');
    if (!name) return;
    
    const path = `${rootPath}/${name}`;
    
    try {
      await invoke('create_file', { path });
      await loadDirectory(rootPath);
    } catch (error) {
      console.error('Failed to create file:', error);
      alert(`Failed to create file: ${error}`);
    }
  };

  const handleCreateFolder = async () => {
    if (!rootPath) return;
    
    const name = prompt('Enter folder name:');
    if (!name) return;
    
    const path = `${rootPath}/${name}`;
    
    try {
      await invoke('create_directory', { path });
      await loadDirectory(rootPath);
    } catch (error) {
      console.error('Failed to create folder:', error);
      alert(`Failed to create folder: ${error}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--background)] border-r border-[var(--border)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Files</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCreateFile}
              disabled={!rootPath}
              className="p-1 hover:bg-[var(--surface-hover)] rounded disabled:opacity-50"
              title="New File"
            >
              <FilePlus size={16} />
            </button>
            <button
              onClick={handleCreateFolder}
              disabled={!rootPath}
              className="p-1 hover:bg-[var(--surface-hover)] rounded disabled:opacity-50"
              title="New Folder"
            >
              <FolderPlus size={16} />
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <MagnifyingGlass
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
          />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1 text-sm bg-[var(--surface)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {!rootPath ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <Folder size={48} weight="duotone" className="text-[var(--text-secondary)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)] mb-3">No folder opened</p>
            <button
              onClick={handleOpenFolder}
              className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/90"
            >
              Open Folder
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-32">
            <CircleNotch size={24} className="animate-spin text-[var(--accent)]" weight="bold" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-4 text-center text-sm text-[var(--text-secondary)]">
            {searchQuery ? 'No files match your search' : 'Empty folder'}
          </div>
        ) : (
          <div className="py-1">
            {filteredFiles.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                level={0}
                onSelect={handleSelectFile}
                onDelete={handleDeleteFile}
                onRename={handleRenameFile}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
