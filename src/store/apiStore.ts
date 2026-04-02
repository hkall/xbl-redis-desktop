import { create } from 'zustand'
import { ApiState, ApiProject, SavedRequest, HistoryItem, Environment, KeyValue, RequestFolder, isFolder, isRequest, RecycleBinItem, RequestBody } from './types'

// 默认请求
const createDefaultRequest = (): SavedRequest => ({
  id: '',
  name: '',
  method: 'GET',
  url: '',
  headers: [],
  params: [],
  body: { type: 'none', content: '', formData: [] },
  auth: { type: 'none' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

// 默认环境
const createDefaultEnvironments = (): Environment[] => [
  {
    id: 'env-default',
    name: '默认环境',
    variables: [
      { key: 'baseUrl', value: 'http://localhost:8080', enabled: true, description: 'API基础URL' },
    ],
  },
]

// 创建默认项目
const createDefaultProject = (name: string = '默认项目'): ApiProject => {
  const id = crypto.randomUUID()
  return {
    id,
    name,
    description: '',
    requestFolders: [],
    rootRequests: [],
    environments: createDefaultEnvironments(),
    activeEnvId: 'env-default',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

// 默认项目
const DEFAULT_PROJECT = createDefaultProject()

interface ApiActions {
  // 项目管理
  addProject: (name: string, description?: string) => void
  updateProject: (id: string, updates: Partial<Pick<ApiProject, 'name' | 'description'>>) => void
  deleteProject: (id: string) => boolean
  switchProject: (id: string) => void
  getActiveProject: () => ApiProject | null

  // 环境管理（项目内）
  setActiveEnv: (id: string | null) => void
  addEnvironment: (env: Omit<Environment, 'id'>) => void
  updateEnvironment: (id: string, env: Partial<Environment>) => void
  deleteEnvironment: (id: string) => void

  // 文件夹管理（项目内）
  addFolder: (name: string, parentId: string | null) => void
  updateFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void

  // 请求管理（项目内）
  saveRequest: (request: Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'>, folderId: string | null) => void
  updateSavedRequest: (id: string, request: Partial<SavedRequest>) => void
  deleteSavedRequest: (id: string) => void
  moveRequest: (id: string, folderId: string | null) => boolean
  duplicateRequest: (id: string) => SavedRequest | null

  // 获取所有请求（扁平化）
  getAllRequests: () => SavedRequest[]
  // 根据ID查找请求
  findRequestById: (id: string) => SavedRequest | null

  // 历史管理（全局）
  addHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'> & { projectId?: string }) => void
  deleteHistoryItem: (id: string) => void
  clearHistory: () => void

  // Tab管理
  openTabs: string[]
  activeTabId: string | null
  openTab: (requestId: string) => void
  closeTab: (requestId: string) => void
  switchTab: (requestId: string) => void

  // 当前请求
  setCurrentRequest: (request: SavedRequest | null) => void
  updateCurrentRequest: (request: Partial<SavedRequest>) => void

  // 当前响应
  setCurrentResponse: (response: any | null) => void
  setCurrentError: (error: string | null) => void
  setLoading: (loading: boolean) => void

  // 导入导出（项目维度）
  exportProject: (projectId?: string) => string
  importProject: (json: string) => boolean
  importOpenAPI: (json: string, projectId?: string) => boolean

  // 加载保存的数据
  loadFromStorage: () => Promise<void>
  saveToStorage: () => Promise<void>

  // 定位请求
  locateRequestId: string | null
  setLocateRequestId: (id: string | null) => void

  // 回收站
  recycleBin: RecycleBinItem[]
  addToRecycleBin: (item: Omit<RecycleBinItem, 'id' | 'deletedAt' | 'expiresAt'>) => void
  restoreFromRecycleBin: (itemId: string) => boolean
  permanentlyDelete: (itemId: string) => void
  clearExpiredItems: () => void
  clearRecycleBin: () => void
}

// 历史记录最大条数
const MAX_HISTORY = 30

// ==================== 辅助函数 ====================

// 递归查找并删除文件夹
function findAndDeleteFolder(folders: RequestFolder[], id: string): RequestFolder[] {
  return folders.filter(f => f.id !== id).map(f => ({
    ...f,
    children: f.children
      .filter(c => isFolder(c) ? c.id !== id : true)
      .map(c => isFolder(c) ? { ...c, children: findAndDeleteFolder([c], id)[0]?.children || [] } : c)
  }))
}

// 递归查找文件夹
function findFolder(folders: RequestFolder[], id: string): RequestFolder | null {
  for (const f of folders) {
    if (f.id === id) return f
    for (const c of f.children) {
      if (isFolder(c)) {
        const found = findFolder([c], id)
        if (found) return found
      }
    }
  }
  return null
}

// 递归查找请求
function findRequest(folders: RequestFolder[], rootRequests: SavedRequest[], id: string): SavedRequest | null {
  const rootFound = rootRequests.find(r => r.id === id)
  if (rootFound) return rootFound

  for (const f of folders) {
    for (const c of f.children) {
      if (isRequest(c) && c.id === id) return c
      if (isFolder(c)) {
        const found = findRequest([c], [], id)
        if (found) return found
      }
    }
  }
  return null
}

// 递归删除请求
function deleteRequestFromFolders(folders: RequestFolder[], id: string): RequestFolder[] {
  return folders.map(f => ({
    ...f,
    children: f.children
      .filter(c => isRequest(c) ? c.id !== id : true)
      .map(c => isFolder(c) ? { ...c, children: deleteRequestFromFolders([c], id)[0]?.children || [] } : c)
  }))
}

// 递归添加请求到文件夹
function addRequestToFolder(folders: RequestFolder[], folderId: string, request: SavedRequest): RequestFolder[] {
  return folders.map(f => {
    if (f.id === folderId) {
      return { ...f, children: [...f.children, request], updatedAt: Date.now() }
    }
    return {
      ...f,
      children: f.children.map(c =>
        isFolder(c) ? { ...c, children: addRequestToFolder([c], folderId, request)[0]?.children || c.children } : c
      )
    }
  })
}

// 递归添加文件夹到文件夹
function addFolderToFolder(folders: RequestFolder[], folderId: string, newFolder: RequestFolder): RequestFolder[] {
  return folders.map(f => {
    if (f.id === folderId) {
      return { ...f, children: [...f.children, newFolder], updatedAt: Date.now() }
    }
    return {
      ...f,
      children: f.children.map(c =>
        isFolder(c) ? { ...c, children: addFolderToFolder([c], folderId, newFolder)[0]?.children || c.children } : c
      )
    }
  })
}

// 更新文件夹中的请求
function updateRequestInFolders(folders: RequestFolder[], id: string, updates: Partial<SavedRequest>): RequestFolder[] {
  return folders.map(f => ({
    ...f,
    children: f.children.map(c => {
      if (isRequest(c) && c.id === id) {
        return { ...c, ...updates, updatedAt: Date.now() }
      }
      if (isFolder(c)) {
        return { ...c, children: updateRequestInFolders([c], id, updates)[0]?.children || c.children }
      }
      return c
    })
  }))
}

// 移动请求到文件夹
function moveRequestToFolder(
  folders: RequestFolder[],
  rootRequests: SavedRequest[],
  requestId: string,
  targetFolderId: string | null
): { folders: RequestFolder[]; rootRequests: SavedRequest[] } {
  const request = findRequest(folders, rootRequests, requestId)
  if (!request) return { folders, rootRequests }

  const newFolders = deleteRequestFromFolders(folders, requestId)
  const newRootRequests = rootRequests.filter(r => r.id !== requestId)

  if (targetFolderId === null) {
    return { folders: newFolders, rootRequests: [...newRootRequests, request] }
  } else {
    return { folders: addRequestToFolder(newFolders, targetFolderId, request), rootRequests: newRootRequests }
  }
}

// 扁平化所有请求
function flattenRequests(folders: RequestFolder[], rootRequests: SavedRequest[]): SavedRequest[] {
  const result: SavedRequest[] = [...rootRequests]
  for (const f of folders) {
    for (const c of f.children) {
      if (isRequest(c)) result.push(c)
      else if (isFolder(c)) result.push(...flattenRequests([c], []))
    }
  }
  return result
}

// 递归添加文件夹到父文件夹
function addFolderToParent(folders: RequestFolder[], parentId: string, newFolder: RequestFolder): RequestFolder[] {
  return folders.map(f => {
    if (f.id === parentId) {
      return { ...f, children: [...f.children, newFolder], updatedAt: Date.now() }
    }
    return {
      ...f,
      children: f.children.map(c =>
        isFolder(c) ? { ...c, children: addFolderToParent([c], parentId, newFolder)[0]?.children || c.children } : c
      )
    }
  })
}

// ==================== Store ====================

export const useApiStore = create<ApiState & ApiActions>((set, get) => ({
  // 初始状态
  projects: [DEFAULT_PROJECT],
  activeProjectId: DEFAULT_PROJECT.id,
  history: [],
  currentRequest: createDefaultRequest(),
  currentResponse: null,
  currentError: null,
  loading: false,
  openTabs: [],
  activeTabId: null,
  locateRequestId: null,
  recycleBin: [],

  // 获取当前激活项目
  getActiveProject: () => {
    const state = get()
    if (!state.activeProjectId && state.projects.length > 0) {
      return state.projects[0]
    }
    return state.projects.find(p => p.id === state.activeProjectId) || null
  },

  // 项目管理
  addProject: (name, description) => set((state) => {
    const newProject: ApiProject = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      requestFolders: [],
      rootRequests: [],
      environments: createDefaultEnvironments(),
      activeEnvId: 'env-default',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    return {
      projects: [...state.projects, newProject],
      activeProjectId: newProject.id,
      openTabs: [],
      activeTabId: null,
      currentRequest: createDefaultRequest(),
    }
  }),

  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map(p =>
      p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
    )
  })),

  deleteProject: (id) => {
    const state = get()
    if (state.projects.length <= 1) {
      return false
    }
    const newProjects = state.projects.filter(p => p.id !== id)
    const newActiveId = state.activeProjectId === id ? newProjects[0]?.id || null : state.activeProjectId
    set({
      projects: newProjects,
      activeProjectId: newActiveId,
      openTabs: [],
      activeTabId: null,
      currentRequest: createDefaultRequest(),
    })
    return true
  },

  switchProject: (id) => set((state) => {
    const project = state.projects.find(p => p.id === id)
    if (!project) return state
    return {
      activeProjectId: id,
      openTabs: [],
      activeTabId: null,
      currentRequest: createDefaultRequest(),
    }
  }),

  // Tab管理
  openTab: (requestId) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state

    if (state.openTabs.includes(requestId)) {
      const request = findRequest(project.requestFolders, project.rootRequests, requestId)
      return { activeTabId: requestId, currentRequest: request || state.currentRequest }
    }
    const request = findRequest(project.requestFolders, project.rootRequests, requestId)
    if (!request) return state
    return {
      openTabs: [...state.openTabs, requestId],
      activeTabId: requestId,
      currentRequest: request
    }
  }),

  closeTab: (requestId) => set((state) => {
    const project = state.getActiveProject()
    const newTabs = state.openTabs.filter(id => id !== requestId)
    if (state.activeTabId === requestId) {
      const currentIndex = state.openTabs.indexOf(requestId)
      let newActiveId: string | null = null
      if (newTabs.length > 0) {
        newActiveId = newTabs[Math.min(currentIndex, newTabs.length - 1)]
      }
      const newRequest = newActiveId && project
        ? findRequest(project.requestFolders, project.rootRequests, newActiveId)
        : createDefaultRequest()
      return {
        openTabs: newTabs,
        activeTabId: newActiveId,
        currentRequest: newRequest || createDefaultRequest()
      }
    }
    return { openTabs: newTabs }
  }),

  switchTab: (requestId) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state
    const request = findRequest(project.requestFolders, project.rootRequests, requestId)
    if (!request) return state
    return { activeTabId: requestId, currentRequest: request }
  }),

  // 环境管理（项目内）
  setActiveEnv: (id) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state
    return {
      projects: state.projects.map(p =>
        p.id === project.id ? { ...p, activeEnvId: id, updatedAt: Date.now() } : p
      )
    }
  }),

  addEnvironment: (env) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state
    return {
      projects: state.projects.map(p =>
        p.id === project.id
          ? { ...p, environments: [...p.environments, { ...env, id: crypto.randomUUID() }], updatedAt: Date.now() }
          : p
      )
    }
  }),

  updateEnvironment: (id, env) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state
    return {
      projects: state.projects.map(p =>
        p.id === project.id
          ? {
              ...p,
              environments: p.environments.map((e) => e.id === id ? { ...e, ...env } : e),
              updatedAt: Date.now()
            }
          : p
      )
    }
  }),

  deleteEnvironment: (id) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state
    return {
      projects: state.projects.map(p =>
        p.id === project.id
          ? {
              ...p,
              environments: p.environments.filter((e) => e.id !== id),
              activeEnvId: p.activeEnvId === id ? p.environments[0]?.id || null : p.activeEnvId,
              updatedAt: Date.now()
            }
          : p
      )
    }
  }),

  // 文件夹管理（项目内）
  addFolder: (name, parentId) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state

    const newFolder: RequestFolder = {
      id: crypto.randomUUID(),
      name,
      parentId,
      children: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    let newFolders: RequestFolder[]
    if (parentId === null) {
      newFolders = [...project.requestFolders, newFolder]
    } else {
      newFolders = project.requestFolders.map(f => {
        if (f.id === parentId) {
          return { ...f, children: [...f.children, newFolder], updatedAt: Date.now() }
        }
        return {
          ...f,
          children: f.children.map(c =>
            isFolder(c) ? { ...c, children: addFolderToParent([c], parentId, newFolder)[0]?.children || c.children } : c
          )
        }
      })
    }

    return {
      projects: state.projects.map(p =>
        p.id === project.id ? { ...p, requestFolders: newFolders, updatedAt: Date.now() } : p
      )
    }
  }),

  updateFolder: (id, name) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state

    const updateFolders = (folders: RequestFolder[]): RequestFolder[] =>
      folders.map(f => {
        if (f.id === id) return { ...f, name, updatedAt: Date.now() }
        return {
          ...f,
          children: f.children.map(c =>
            isFolder(c) && c.id === id ? { ...c, name, updatedAt: Date.now() } : c
          )
        }
      })

    return {
      projects: state.projects.map(p =>
        p.id === project.id ? { ...p, requestFolders: updateFolders(p.requestFolders), updatedAt: Date.now() } : p
      )
    }
  }),

  deleteFolder: (id) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state

    // 查找文件夹和其父文件夹ID
    const folder = findFolder(project.requestFolders, id)
    let parentFolderId: string | null = null

    // 检查是否在根目录
    if (project.requestFolders.some(f => f.id === id)) {
      parentFolderId = null
    } else {
      // 查找父文件夹ID
      const findParentFolderId = (folders: RequestFolder[], targetId: string): string | null => {
        for (const f of folders) {
          if (f.children.some(c => isFolder(c) && c.id === targetId)) {
            return f.id
          }
          const childFolders = f.children.filter(isFolder) as RequestFolder[]
          const found = findParentFolderId(childFolders, targetId)
          if (found) return found
        }
        return null
      }
      parentFolderId = findParentFolderId(project.requestFolders, id)
    }

    // 添加到回收站
    if (folder) {
      const recycleItem: Omit<RecycleBinItem, 'id' | 'deletedAt' | 'expiresAt'> = {
        type: 'folder',
        name: folder.name,
        data: folder,
        projectId: project.id,
        projectName: project.name,
        parentFolderId,
      }
      get().addToRecycleBin(recycleItem)
    }

    return {
      projects: state.projects.map(p =>
        p.id === project.id
          ? { ...p, requestFolders: findAndDeleteFolder(p.requestFolders, id), updatedAt: Date.now() }
          : p
      )
    }
  }),

  // 请求管理（项目内）
  saveRequest: (request, folderId) => {
    const state = get()
    const project = state.getActiveProject()
    if (!project) return

    const newId = crypto.randomUUID()
    const newRequest: SavedRequest = {
      ...request,
      id: newId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    set((s) => {
      const p = s.getActiveProject()
      if (!p) return s

      let newFolders = p.requestFolders
      let newRootRequests = p.rootRequests

      if (folderId === null) {
        newRootRequests = [...p.rootRequests, newRequest]
      } else {
        newFolders = addRequestToFolder(p.requestFolders, folderId, newRequest)
      }

      return {
        projects: s.projects.map(proj =>
          proj.id === p.id
            ? { ...proj, requestFolders: newFolders, rootRequests: newRootRequests, updatedAt: Date.now() }
            : proj
        ),
        openTabs: [...s.openTabs, newId],
        activeTabId: newId,
        currentRequest: newRequest,
      }
    })
  },

  updateSavedRequest: (id, request) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state

    return {
      projects: state.projects.map(p =>
        p.id === project.id
          ? {
              ...p,
              rootRequests: p.rootRequests.map(r =>
                r.id === id ? { ...r, ...request, updatedAt: Date.now() } : r
              ),
              requestFolders: updateRequestInFolders(p.requestFolders, id, request),
              updatedAt: Date.now()
            }
          : p
      )
    }
  }),

  deleteSavedRequest: (id) => set((state) => {
    const project = state.getActiveProject()
    if (!project) return state

    // 查找请求和其父文件夹ID
    const request = findRequest(project.requestFolders, project.rootRequests, id)
    let parentFolderId: string | null = null

    // 检查是否在根请求中
    if (project.rootRequests.some(r => r.id === id)) {
      parentFolderId = null
    } else {
      // 查找父文件夹ID
      const findParentFolderId = (folders: RequestFolder[], requestId: string): string | null => {
        for (const f of folders) {
          if (f.children.some(c => isRequest(c) && c.id === requestId)) {
            return f.id
          }
          const childFolders = f.children.filter(isFolder) as RequestFolder[]
          const found = findParentFolderId(childFolders, requestId)
          if (found) return found
        }
        return null
      }
      parentFolderId = findParentFolderId(project.requestFolders, id)
    }

    // 添加到回收站
    if (request) {
      const recycleItem: Omit<RecycleBinItem, 'id' | 'deletedAt' | 'expiresAt'> = {
        type: 'request',
        name: request.name || request.url,
        data: request,
        projectId: project.id,
        projectName: project.name,
        parentFolderId,
      }
      get().addToRecycleBin(recycleItem)
    }

    return {
      projects: state.projects.map(p =>
        p.id === project.id
          ? {
              ...p,
              rootRequests: p.rootRequests.filter(r => r.id !== id),
              requestFolders: deleteRequestFromFolders(p.requestFolders, id),
              updatedAt: Date.now()
            }
          : p
      ),
      openTabs: state.openTabs.filter(tid => tid !== id),
      activeTabId: state.activeTabId === id ? (state.openTabs.filter(t => t !== id)[0] || null) : state.activeTabId,
    }
  }),

  moveRequest: (id, folderId) => {
    const state = get()
    const project = state.getActiveProject()
    if (!project) return

    const request = findRequest(project.requestFolders, project.rootRequests, id)
    if (!request) return

    // 检查目标目录是否存在同名请求
    const checkNameExists = (name: string, targetFolderId: string | null): boolean => {
      if (targetFolderId === null) {
        for (const r of project.rootRequests) {
          if (r.id !== id && r.name === name) return true
        }
      }
      const checkFolder = (folders: RequestFolder[]): boolean => {
        for (const f of folders) {
          if (f.id === targetFolderId) {
            for (const c of f.children) {
              if (isRequest(c) && c.id !== id && c.name === name) return true
            }
            return false
          }
          const childFolders = f.children.filter(isFolder) as RequestFolder[]
          if (checkFolder(childFolders)) return true
        }
        return false
      }
      if (targetFolderId !== null) {
        return checkFolder(project.requestFolders)
      }
      return false
    }

    if (checkNameExists(request.name, folderId)) {
      return false
    }

    const result = moveRequestToFolder(project.requestFolders, project.rootRequests, id, folderId)
    set((s) => ({
      projects: s.projects.map(p =>
        p.id === project.id
          ? { ...p, requestFolders: result.folders, rootRequests: result.rootRequests, updatedAt: Date.now() }
          : p
      )
    }))
    return true
  },

  duplicateRequest: (id) => {
    const state = get()
    const project = state.getActiveProject()
    if (!project) return null

    const request = findRequest(project.requestFolders, project.rootRequests, id)
    if (!request) return null

    // 查找请求所在的文件夹
    const findParentFolderId = (folders: RequestFolder[], requestId: string): string | null => {
      for (const f of folders) {
        if (f.children.some(c => isRequest(c) && c.id === requestId)) return f.id
        const childFolders = f.children.filter(isFolder) as RequestFolder[]
        const found = findParentFolderId(childFolders, requestId)
        if (found !== null) return found
      }
      return null
    }

    const parentFolderId = project.rootRequests.some(r => r.id === id)
      ? null
      : findParentFolderId(project.requestFolders, id)

    // 创建新请求
    const newRequest: SavedRequest = {
      ...request,
      id: crypto.randomUUID(),
      name: `${request.name} (副本)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // 添加到同一目录
    if (parentFolderId === null) {
      set((s) => {
        const p = s.getActiveProject()
        if (!p) return s
        return {
          projects: s.projects.map(proj =>
            proj.id === p.id
              ? { ...proj, rootRequests: [...proj.rootRequests, newRequest], updatedAt: Date.now() }
              : proj
          )
        }
      })
    } else {
      const updatedFolders = addRequestToFolder(project.requestFolders, parentFolderId, newRequest)
      set((s) => {
        const p = s.getActiveProject()
        if (!p) return s
        return {
          projects: s.projects.map(proj =>
            proj.id === p.id
              ? { ...proj, requestFolders: updatedFolders, updatedAt: Date.now() }
              : proj
          )
        }
      })
    }

    return newRequest
  },

  getAllRequests: () => {
    const state = get()
    const project = state.getActiveProject()
    if (!project) return []
    return flattenRequests(project.requestFolders, project.rootRequests)
  },

  findRequestById: (id) => {
    const state = get()
    const project = state.getActiveProject()
    if (!project) return null
    return findRequest(project.requestFolders, project.rootRequests, id)
  },

  // 历史管理（全局）
  addHistory: (item) => set((state) => {
    const newHistory = [
      { ...item, id: crypto.randomUUID(), timestamp: Date.now() },
      ...state.history,
    ].slice(0, MAX_HISTORY)
    return { history: newHistory }
  }),

  deleteHistoryItem: (id) => set((state) => ({
    history: state.history.filter((h) => h.id !== id),
  })),

  clearHistory: () => set({ history: [] }),

  // 当前请求
  setCurrentRequest: (request) => set({ currentRequest: request }),

  updateCurrentRequest: (request) => set((state) => ({
    currentRequest: state.currentRequest
      ? { ...state.currentRequest, ...request, updatedAt: Date.now() }
      : createDefaultRequest(),
  })),

  // 当前响应
  setCurrentResponse: (response) => set({ currentResponse: response, currentError: null }),

  setCurrentError: (error) => set({ currentError: error, currentResponse: null }),

  setLoading: (loading) => set({ loading }),

  // 导出项目
  exportProject: (projectId) => {
    const state = get()
    const project = projectId
      ? state.projects.find(p => p.id === projectId)
      : state.getActiveProject()

    if (!project) return ''

    const data = {
      version: '3.0',
      exportedAt: Date.now(),
      project: {
        name: project.name,
        description: project.description,
        requestFolders: project.requestFolders,
        rootRequests: project.rootRequests,
        environments: project.environments,
      }
    }
    return JSON.stringify(data, null, 2)
  },

  // 导入项目
  importProject: (json) => {
    try {
      const data = JSON.parse(json)

      // 支持项目格式 (v3.0)
      if (data.version === '3.0' && data.project) {
        const newProject: ApiProject = {
          id: crypto.randomUUID(),
          name: data.project.name || '导入的项目',
          description: data.project.description || '',
          requestFolders: data.project.requestFolders || [],
          rootRequests: data.project.rootRequests || [],
          environments: data.project.environments || createDefaultEnvironments(),
          activeEnvId: data.project.environments?.[0]?.id || 'env-default',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          projects: [...state.projects, newProject],
          activeProjectId: newProject.id,
          openTabs: [],
          activeTabId: null,
          currentRequest: createDefaultRequest(),
        }))
        return true
      }

      // 兼容旧版本格式 (v2.0)
      if (data.version === '2.0') {
        const newProject: ApiProject = {
          id: crypto.randomUUID(),
          name: '导入的项目',
          description: '',
          requestFolders: data.requestFolders || [],
          rootRequests: data.rootRequests || [],
          environments: data.environments || createDefaultEnvironments(),
          activeEnvId: data.environments?.[0]?.id || 'env-default',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          projects: [...state.projects, newProject],
          activeProjectId: newProject.id,
          openTabs: [],
          activeTabId: null,
          currentRequest: createDefaultRequest(),
        }))
        return true
      }

      // 兼容更旧版本 (v1.0)
      if (data.version === '1.0' && data.savedRequests) {
        const newProject: ApiProject = {
          id: crypto.randomUUID(),
          name: '导入的项目',
          description: '',
          requestFolders: [],
          rootRequests: data.savedRequests,
          environments: data.environments || createDefaultEnvironments(),
          activeEnvId: 'env-default',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          projects: [...state.projects, newProject],
          activeProjectId: newProject.id,
          openTabs: [],
          activeTabId: null,
          currentRequest: createDefaultRequest(),
        }))
        return true
      }

      return false
    } catch {
      return false
    }
  },

  // 导入OpenAPI
  importOpenAPI: (json, projectId) => {
    try {
      const data = JSON.parse(json)

      // 检查是否是OpenAPI文档
      if (!data.openapi && !data.swagger) {
        return false
      }

      const state = get()
      // 如果projectId为null，表示创建新项目
      const shouldCreateNewProject = projectId === null
      const targetProjectId = shouldCreateNewProject ? null : (projectId || state.activeProjectId || state.projects[0]?.id)

      // 解析OpenAPI文档
      const projectName = data.info?.title || 'OpenAPI导入'
      const baseUrl = data.servers?.[0]?.url || data.host || ''

      // 提取环境变量
      const environments: Environment[] = [{
        id: 'env-default',
        name: '默认环境',
        variables: baseUrl ? [{ key: 'baseUrl', value: baseUrl, enabled: true, description: 'API基础URL' }] : [],
      }]

      // 获取components/schemas用于解析引用
      const schemas = data.components?.schemas || data.definitions || {}

      // 解析schema引用
      const resolveRef = (ref: string): any => {
        if (!ref.startsWith('#/')) return null
        const parts = ref.slice(2).split('/')
        let result: any = data
        for (const part of parts) {
          result = result?.[part]
        }
        return result
      }

      // 根据schema生成示例值
      const generateExample = (schema: any): any => {
        if (!schema) return null

        // 处理引用
        if (schema.$ref) {
          schema = resolveRef(schema.$ref)
        }

        if (schema.example !== undefined) return schema.example
        if (schema.default !== undefined) return schema.default

        switch (schema.type) {
          case 'string':
            if (schema.enum) return schema.enum[0]
            if (schema.format === 'date') return '2024-01-01'
            if (schema.format === 'date-time') return '2024-01-01T00:00:00Z'
            if (schema.format === 'email') return 'user@example.com'
            if (schema.format === 'uri') return 'https://example.com'
            return schema.description || 'string'
          case 'number':
          case 'integer':
            return 0
          case 'boolean':
            return false
          case 'array':
            if (schema.items) {
              return [generateExample(schema.items)]
            }
            return []
          case 'object':
            const obj: Record<string, any> = {}
            if (schema.properties) {
              for (const [key, prop] of Object.entries(schema.properties)) {
                obj[key] = generateExample(prop)
              }
            }
            return obj
          default:
            return null
        }
      }

      // 按tag分组创建文件夹
      const tagFolders: Map<string, RequestFolder> = new Map()
      const rootRequests: SavedRequest[] = []

      // 解析paths
      if (data.paths) {
        for (const [path, methods] of Object.entries(data.paths)) {
          for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
            if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method.toLowerCase())) continue

            const op = operation as any
            const tagName = op.tags?.[0] || '默认'
            const requestName = op.summary || op.operationId || `${method.toUpperCase()} ${path}`

            // 解析参数
            const params: KeyValue[] = []
            const headers: KeyValue[] = []

            if (op.parameters) {
              for (const param of op.parameters) {
                const p = param.$ref ? resolveRef(param.$ref) : param
                if (!p) continue

                if (p.in === 'query') {
                  params.push({
                    key: p.name,
                    value: generateExample(p.schema) || '',
                    enabled: p.required !== false,
                    description: p.description,
                  })
                } else if (p.in === 'header') {
                  headers.push({
                    key: p.name,
                    value: generateExample(p.schema) || '',
                    enabled: p.required !== false,
                    description: p.description,
                  })
                }
              }
            }

            // 解析请求体
            let body: RequestBody = { type: 'none', content: '', formData: [] }

            if (op.requestBody) {
              const requestBody = op.requestBody.$ref ? resolveRef(op.requestBody.$ref) : op.requestBody
              if (requestBody?.content) {
                // JSON body
                if (requestBody.content['application/json']) {
                  const jsonContent = requestBody.content['application/json']
                  const schema = jsonContent.schema
                  const example = generateExample(schema)
                  body = {
                    type: 'json',
                    content: example ? JSON.stringify(example, null, 2) : '',
                    formData: [],
                  }
                }
                // Form data
                else if (requestBody.content['multipart/form-data']) {
                  const formSchema = requestBody.content['multipart/form-data']?.schema
                  const resolvedSchema = formSchema?.$ref ? resolveRef(formSchema.$ref) : formSchema
                  const formData: typeof body.formData = []

                  if (resolvedSchema?.properties) {
                    for (const [key, prop] of Object.entries(resolvedSchema.properties)) {
                      const p = prop as any
                      formData.push({
                        key,
                        value: generateExample(p) || '',
                        type: p.type === 'string' && p.format === 'binary' ? 'file' : 'text',
                        enabled: true,
                      })
                    }
                  }
                  body = { type: 'form-data', content: '', formData }
                }
                // URL encoded form
                else if (requestBody.content['application/x-www-form-urlencoded']) {
                  const formSchema = requestBody.content['application/x-www-form-urlencoded']?.schema
                  const resolvedSchema = formSchema?.$ref ? resolveRef(formSchema.$ref) : formSchema
                  const formData: typeof body.formData = []

                  if (resolvedSchema?.properties) {
                    for (const [key, prop] of Object.entries(resolvedSchema.properties)) {
                      formData.push({
                        key,
                        value: generateExample(prop) || '',
                        type: 'text',
                        enabled: true,
                      })
                    }
                  }
                  body = { type: 'x-www-form-urlencoded', content: '', formData }
                }
              }
            }

            const newRequest: SavedRequest = {
              id: crypto.randomUUID(),
              name: requestName,
              method: method.toUpperCase() as any,
              url: baseUrl ? `{{baseUrl}}${path}` : path,
              headers,
              params,
              body,
              auth: { type: 'none' },
              description: op.description,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }

            // 添加到对应tag的文件夹
            if (!tagFolders.has(tagName)) {
              tagFolders.set(tagName, {
                id: crypto.randomUUID(),
                name: tagName,
                parentId: null,
                children: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              })
            }
            tagFolders.get(tagName)!.children.push(newRequest)
          }
        }
      }

      const requestFolders = Array.from(tagFolders.values())

      // 创建新项目或合并到现有项目
      if (shouldCreateNewProject) {
        // 创建新项目
        const newProject: ApiProject = {
          id: crypto.randomUUID(),
          name: `${projectName} (导入)`,
          description: '',
          requestFolders,
          rootRequests,
          environments,
          activeEnvId: 'env-default',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set(s => ({
          projects: [...s.projects, newProject],
          activeProjectId: newProject.id,
        }))
      } else if (targetProjectId) {
        // 合并到现有项目
        set((s) => {
          const existingProject = s.projects.find(p => p.id === targetProjectId)
          if (existingProject) {
            return {
              projects: s.projects.map(p =>
                p.id === targetProjectId
                  ? {
                      ...p,
                      requestFolders: [...p.requestFolders, ...requestFolders],
                      rootRequests: [...p.rootRequests, ...rootRequests],
                      updatedAt: Date.now(),
                    }
                  : p
              ),
              activeProjectId: targetProjectId,
            }
          }
          return s
        })
      }

      return true
    } catch (error) {
      console.error('Failed to import OpenAPI:', error)
      return false
    }
  },

  // 从存储加载
  loadFromStorage: async () => {
    try {
      if (window.electronAPI?.loadConfig) {
        // 加载项目列表
        const projectsResult = await window.electronAPI.loadConfig('api/projects')
        if (projectsResult.success && projectsResult.data && projectsResult.data.length > 0) {
          set({ projects: projectsResult.data.projects, activeProjectId: projectsResult.data.activeProjectId })
        } else {
          // 兼容旧版本：迁移数据到默认项目
          const envResult = await window.electronAPI.loadConfig('api/environments')
          const foldersResult = await window.electronAPI.loadConfig('api/folders')
          const savedResult = await window.electronAPI.loadConfig('api/saved')

          const defaultProject = createDefaultProject()
          if (envResult.success && envResult.data) {
            defaultProject.environments = envResult.data
          }
          if (foldersResult.success && foldersResult.data) {
            defaultProject.requestFolders = foldersResult.data.folders || []
            defaultProject.rootRequests = foldersResult.data.rootRequests || []
          } else if (savedResult.success && savedResult.data) {
            defaultProject.rootRequests = savedResult.data
          }

          set({ projects: [defaultProject], activeProjectId: defaultProject.id })
        }

        // 加载历史记录
        const historyResult = await window.electronAPI.loadConfig('api/history')
        if (historyResult.success && historyResult.data) {
          set({ history: historyResult.data })
        }

        // 加载回收站
        const recycleBinResult = await window.electronAPI.loadConfig('api/recycleBin')
        if (recycleBinResult.success && recycleBinResult.data) {
          set({ recycleBin: recycleBinResult.data })
          // 清理过期项
          get().clearExpiredItems()
        }
      }
    } catch (error) {
      console.error('Failed to load API data:', error)
    }
  },

  // 保存到存储
  saveToStorage: async () => {
    try {
      const state = get()
      if (window.electronAPI?.saveConfig) {
        await window.electronAPI.saveConfig('api/projects', {
          projects: state.projects,
          activeProjectId: state.activeProjectId,
        })
        await window.electronAPI.saveConfig('api/history', state.history)
        await window.electronAPI.saveConfig('api/recycleBin', state.recycleBin)
      }
    } catch (error) {
      console.error('Failed to save API data:', error)
    }
  },

  // 设置定位请求ID
  setLocateRequestId: (id) => set({ locateRequestId: id }),

  // 回收站操作
  addToRecycleBin: (item) => set((state) => {
    const now = Date.now()
    const recycleItem: RecycleBinItem = {
      ...item,
      id: crypto.randomUUID(),
      deletedAt: now,
      expiresAt: now + 3 * 24 * 60 * 60 * 1000, // 3天后过期
    }
    return {
      recycleBin: [recycleItem, ...state.recycleBin]
    }
  }),

  restoreFromRecycleBin: (itemId) => {
    const state = get()
    const item = state.recycleBin.find(r => r.id === itemId)
    if (!item) return false

    const project = state.projects.find(p => p.id === item.projectId)
    if (!project) {
      // 原项目不存在，恢复到当前活动项目
      const activeProject = state.getActiveProject()
      if (!activeProject) return false

      if (item.type === 'request') {
        const request = item.data as SavedRequest
        set(s => ({
          projects: s.projects.map(p =>
            p.id === activeProject.id
              ? { ...p, rootRequests: [...p.rootRequests, request], updatedAt: Date.now() }
              : p
          ),
          recycleBin: s.recycleBin.filter(r => r.id !== itemId)
        }))
      } else {
        const folder = item.data as RequestFolder
        set(s => ({
          projects: s.projects.map(p =>
            p.id === activeProject.id
              ? { ...p, requestFolders: [...p.requestFolders, folder], updatedAt: Date.now() }
              : p
          ),
          recycleBin: s.recycleBin.filter(r => r.id !== itemId)
        }))
      }
      return true
    }

    // 原项目存在
    if (item.type === 'request') {
      const request = item.data as SavedRequest
      // 检查原父文件夹是否还存在
      if (item.parentFolderId) {
        const parentFolder = findFolder(project.requestFolders, item.parentFolderId)
        if (parentFolder) {
          // 父文件夹存在，恢复到原位置
          set(s => ({
            projects: s.projects.map(p =>
              p.id === item.projectId
                ? {
                    ...p,
                    requestFolders: addRequestToFolder(p.requestFolders, item.parentFolderId!, request),
                    updatedAt: Date.now()
                  }
                : p
            ),
            recycleBin: s.recycleBin.filter(r => r.id !== itemId)
          }))
        } else {
          // 父文件夹不存在，恢复到根目录
          set(s => ({
            projects: s.projects.map(p =>
              p.id === item.projectId
                ? { ...p, rootRequests: [...p.rootRequests, request], updatedAt: Date.now() }
                : p
            ),
            recycleBin: s.recycleBin.filter(r => r.id !== itemId)
          }))
        }
      } else {
        // 原来就在根目录，恢复到根目录
        set(s => ({
          projects: s.projects.map(p =>
            p.id === item.projectId
              ? { ...p, rootRequests: [...p.rootRequests, request], updatedAt: Date.now() }
              : p
          ),
          recycleBin: s.recycleBin.filter(r => r.id !== itemId)
        }))
      }
    } else {
      // 恢复文件夹
      const folder = item.data as RequestFolder
      if (item.parentFolderId) {
        const parentFolder = findFolder(project.requestFolders, item.parentFolderId)
        if (parentFolder) {
          // 父文件夹存在，恢复到原位置
          set(s => ({
            projects: s.projects.map(p =>
              p.id === item.projectId
                ? {
                    ...p,
                    requestFolders: addFolderToFolder(p.requestFolders, item.parentFolderId!, folder),
                    updatedAt: Date.now()
                  }
                : p
            ),
            recycleBin: s.recycleBin.filter(r => r.id !== itemId)
          }))
        } else {
          // 父文件夹不存在，恢复到根目录
          set(s => ({
            projects: s.projects.map(p =>
              p.id === item.projectId
                ? { ...p, requestFolders: [...p.requestFolders, folder], updatedAt: Date.now() }
                : p
            ),
            recycleBin: s.recycleBin.filter(r => r.id !== itemId)
          }))
        }
      } else {
        // 原来就在根目录
        set(s => ({
          projects: s.projects.map(p =>
            p.id === item.projectId
              ? { ...p, requestFolders: [...p.requestFolders, folder], updatedAt: Date.now() }
              : p
          ),
          recycleBin: s.recycleBin.filter(r => r.id !== itemId)
        }))
      }
    }
    return true
  },

  permanentlyDelete: (itemId) => set((state) => ({
    recycleBin: state.recycleBin.filter(r => r.id !== itemId)
  })),

  clearExpiredItems: () => set((state) => {
    const now = Date.now()
    return {
      recycleBin: state.recycleBin.filter(r => r.expiresAt > now)
    }
  }),

  clearRecycleBin: () => set({ recycleBin: [] }),
}))

// 辅助函数：创建空请求
export const createEmptyRequest = (): SavedRequest => createDefaultRequest()

// 辅助函数：获取当前环境的变量映射
export const getActiveVariables = (state: ApiState): Record<string, string> => {
  const project = state.projects.find(p => p.id === state.activeProjectId)
  if (!project) return {}

  const activeEnv = project.environments.find((e) => e.id === project.activeEnvId)
  if (!activeEnv) return {}

  const result: Record<string, string> = {}
  activeEnv.variables
    .filter((v) => v.enabled)
    .forEach((v) => {
      result[v.key] = v.value
    })
  return result
}