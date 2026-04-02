import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Globe, Clock, Folder, FolderOpen, ChevronDown, ChevronRight, Trash2, Plus,
  Download, Upload, Edit2, X, Send, Settings, Move, FilePlus, FolderPlus, Briefcase, Copy, Search, RotateCcw, Archive, Check
} from 'lucide-react'
import { useApiStore } from '@/store/apiStore'
import { SavedRequest, HistoryItem, Environment, KeyValue, HttpMethod, RequestFolder, isFolder, isRequest, ApiProject, RecycleBinItem } from '@/store/types'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useToast } from '@/components/common/Toast'

// HTTP方法颜色
const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-emerald-500',
  POST: 'text-blue-500',
  PUT: 'text-amber-500',
  DELETE: 'text-red-500',
  PATCH: 'text-purple-500',
  HEAD: 'text-gray-500',
  OPTIONS: 'text-gray-500',
}

const METHOD_BG: Record<HttpMethod, string> = {
  GET: 'bg-emerald-500/10',
  POST: 'bg-blue-500/10',
  PUT: 'bg-amber-500/10',
  DELETE: 'bg-red-500/10',
  PATCH: 'bg-purple-500/10',
  HEAD: 'bg-gray-500/10',
  OPTIONS: 'bg-gray-500/10',
}

export default function ApiSidebar() {
  const { showToast } = useToast()
  const {
    projects,
    activeProjectId,
    addProject,
    updateProject,
    deleteProject,
    switchProject,
    getActiveProject,
    setActiveEnv,
    addEnvironment,
    updateEnvironment,
    deleteEnvironment,
    addFolder,
    updateFolder,
    deleteFolder,
    saveRequest,
    updateSavedRequest,
    moveRequest,
    deleteSavedRequest,
    duplicateRequest,
    openTab,
    setCurrentRequest,
    history,
    deleteHistoryItem,
    clearHistory,
    loadFromStorage,
    saveToStorage,
    exportProject,
    importProject,
    importOpenAPI,
    locateRequestId,
    setLocateRequestId,
    recycleBin,
    restoreFromRecycleBin,
    permanentlyDelete,
    clearExpiredItems,
    clearRecycleBin,
  } = useApiStore()

  // 获取store的setState函数
  const setApiStore = useApiStore.setState

  const activeProject = getActiveProject()

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set([activeProjectId || '']))
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['history']))
  const [showEnvModal, setShowEnvModal] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [isNewEnv, setIsNewEnv] = useState(false)
  const [showImportExport, setShowImportExport] = useState<'import' | 'export' | null>(null)
  const [importText, setImportText] = useState('')
  const [selectedExportProjectId, setSelectedExportProjectId] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<'new' | 'merge'>('new')
  const [importTargetProjectId, setImportTargetProjectId] = useState<string | null>(null)
  const [confirmClearHistory, setConfirmClearHistory] = useState(false)
  const [confirmDeleteEnv, setConfirmDeleteEnv] = useState<string | null>(null)
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<string | null>(null)
  const [confirmDeleteRequest, setConfirmDeleteRequest] = useState<string | null>(null)
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<string | null>(null)
  const [confirmRestoreItem, setConfirmRestoreItem] = useState<string | null>(null)
  const [confirmPermanentDeleteItem, setConfirmPermanentDeleteItem] = useState<string | null>(null)
  const [confirmClearRecycleBin, setConfirmClearRecycleBin] = useState(false)

  // 文件夹相关状态
  const [showNewFolderInput, setShowNewFolderInput] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')

  // 请求编辑状态
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [editingRequestName, setEditingRequestName] = useState('')

  // 移动请求状态
  const [movingRequestId, setMovingRequestId] = useState<string | null>(null)
  const [moveMenuPosition, setMoveMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [pendingMovePosition, setPendingMovePosition] = useState<{ top: number; left: number } | null>(null)

  // 请求右键菜单状态
  const [requestContextMenu, setRequestContextMenu] = useState<{ id: string; top: number; left: number } | null>(null)

  // 文件夹右键菜单状态
  const [folderContextMenu, setFolderContextMenu] = useState<{ id: string; top: number; left: number } | null>(null)

  // 搜索状态
  const [searchQuery, setSearchQuery] = useState('')

  // 项目编辑状态
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')

  useEffect(() => { loadFromStorage() }, [])

  useEffect(() => {
    const timer = setTimeout(() => { saveToStorage() }, 500)
    return () => clearTimeout(timer)
  }, [projects, history, recycleBin])

  // 处理定位请求
  useEffect(() => {
    if (locateRequestId && activeProject) {
      // 查找请求所在的文件夹路径
      const findFolderPath = (folders: RequestFolder[], requestId: string, path: string[] = []): string[] | null => {
        for (const folder of folders) {
          // 检查请求是否在这个文件夹的直接子项中
          const hasRequest = folder.children.some(c => isRequest(c) && c.id === requestId)
          if (hasRequest) {
            return [...path, folder.id]
          }
          // 递归检查子文件夹
          const childFolders = folder.children.filter(isFolder) as RequestFolder[]
          const found = findFolderPath(childFolders, requestId, [...path, folder.id])
          if (found) return found
        }
        return null
      }

      // 检查是否在根请求中
      const isInRoot = activeProject.rootRequests.some(r => r.id === locateRequestId)

      if (!isInRoot) {
        const folderPath = findFolderPath(activeProject.requestFolders, locateRequestId)
        if (folderPath) {
          // 展开所有父文件夹
          setExpandedFolders(prev => {
            const next = new Set(prev)
            folderPath.forEach(id => next.add(id))
            return next
          })
        }
      }

      // 展开项目的请求树
      setExpandedSections(prev => {
        const next = new Set(prev)
        next.add('req-' + activeProject.id)
        return next
      })
      setExpandedProjects(prev => {
        const next = new Set(prev)
        next.add(activeProject.id)
        return next
      })

      // 清除定位状态
      setLocateRequestId(null)
    }
  }, [locateRequestId, activeProject])

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const handleSelectRequest = (request: SavedRequest) => { openTab(request.id) }

  const handleSelectHistory = (item: HistoryItem) => {
    setCurrentRequest({
      id: '',
      name: '',
      method: item.request.method,
      url: item.request.url,
      headers: item.request.headers,
      params: item.request.params,
      body: item.request.body,
      auth: item.request.auth,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  const handleExport = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        requestFolders: project.requestFolders,
        rootRequests: project.rootRequests,
        environments: project.environments,
      }
    }

    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setShowImportExport(null)
    setSelectedExportProjectId(null)
  }

  const handleImport = () => {
    if (!importText.trim()) return

    // 检查合并模式是否选择了目标项目
    if (importMode === 'merge' && !importTargetProjectId) {
      showToast('请选择目标项目', 'error')
      return
    }

    // 尝试解析JSON
    let parsedData: any
    try {
      parsedData = JSON.parse(importText)
    } catch {
      showToast('JSON格式无效', 'error')
      return
    }

    // 检测是否是项目导出格式
    if (parsedData.version && parsedData.project) {
      const projectData = parsedData.project
      if (importMode === 'new') {
        // 创建新项目
        // 确保环境变量基于文档真实创建，如果文档没有则使用默认值
        const environments = projectData.environments?.length > 0
          ? projectData.environments
          : [{ id: 'env-default', name: '默认环境', variables: [] }]

        const newProject: ApiProject = {
          id: crypto.randomUUID(),
          name: `${projectData.name} (导入)`,
          description: projectData.description || '',
          requestFolders: projectData.requestFolders || [],
          rootRequests: projectData.rootRequests || [],
          environments,
          activeEnvId: environments[0]?.id || 'env-default',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        // 更新请求和文件夹的ID
        const updateIds = (folders: RequestFolder[], requests: SavedRequest[]) => {
          const idMap = new Map<string, string>()
          // 先生成新ID
          const updateFolderIds = (f: RequestFolder): RequestFolder => {
            const newId = crypto.randomUUID()
            idMap.set(f.id, newId)
            return {
              ...f,
              id: newId,
              children: f.children.map(c => isFolder(c) ? updateFolderIds(c) : { ...c, id: crypto.randomUUID() })
            }
          }
          return {
            folders: folders.map(updateFolderIds),
            requests: requests.map(r => ({ ...r, id: crypto.randomUUID() }))
          }
        }
        const { folders: newFolders, requests: newRequests } = updateIds(newProject.requestFolders || [], newProject.rootRequests || [])
        newProject.requestFolders = newFolders
        newProject.rootRequests = newRequests

        setApiStore(s => ({
          projects: [...s.projects, newProject],
          activeProjectId: newProject.id,
          openTabs: [],
          activeTabId: null,
          currentRequest: null
        }))
        showToast('导入成功', 'success')
      } else if (importTargetProjectId) {
        // 合并到现有项目
        // 更新ID后合并
        const updateIds = (folders: RequestFolder[], requests: SavedRequest[]) => {
          const updateFolderIds = (f: RequestFolder): RequestFolder => ({
            ...f,
            id: crypto.randomUUID(),
            children: f.children.map(c => isFolder(c) ? updateFolderIds(c) : { ...c, id: crypto.randomUUID() })
          })
          return {
            folders: folders.map(updateFolderIds),
            requests: requests.map(r => ({ ...r, id: crypto.randomUUID() }))
          }
        }
        const { folders: newFolders, requests: newRequests } = updateIds(projectData.requestFolders || [], projectData.rootRequests || [])

        setApiStore(s => ({
          projects: s.projects.map(p =>
            p.id === importTargetProjectId
              ? {
                  ...p,
                  requestFolders: [...p.requestFolders, ...newFolders],
                  rootRequests: [...p.rootRequests, ...newRequests],
                  updatedAt: Date.now()
                }
              : p
          )
        }))
        showToast('合并成功', 'success')
      }
      setShowImportExport(null)
      setImportText('')
      setImportTargetProjectId(null)
      return
    }

    // 尝试作为OpenAPI导入
    // importMode === 'new' 时传入null表示创建新项目，'merge'时传入目标项目ID
    const targetId = importMode === 'merge' ? importTargetProjectId : null
    if (importOpenAPI(importText, targetId)) {
      showToast('OpenAPI导入成功', 'success')
      setShowImportExport(null)
      setImportText('')
      setImportTargetProjectId(null)
      return
    }

    showToast('导入失败，请检查格式', 'error')
  }

  // 检查同一层级是否存在同名文件夹
  const checkDuplicateFolderName = (name: string, parentId: string | null, excludeId?: string): boolean => {
    if (!activeProject) return false
    if (parentId === null) {
      // 根目录层级检查
      for (const f of activeProject.requestFolders) {
        if (f.id !== excludeId && f.name === name) return true
      }
    } else {
      // 在父文件夹内检查
      const checkInFolder = (folders: RequestFolder[]): boolean => {
        for (const f of folders) {
          if (f.id === parentId) {
            // 找到父文件夹，检查其children中的文件夹
            for (const c of f.children) {
              if (isFolder(c) && c.id !== excludeId && c.name === name) return true
            }
            return false
          }
          // 继续递归查找父文件夹
          const childFolders = f.children.filter(isFolder) as RequestFolder[]
          if (checkInFolder(childFolders)) return true
        }
        return false
      }
      return checkInFolder(activeProject.requestFolders)
    }
    return false
  }

  const handleAddFolder = (parentId: string | null) => {
    if (newFolderName.trim()) {
      // 检查同一层级是否存在同名文件夹
      if (checkDuplicateFolderName(newFolderName.trim(), parentId)) {
        showToast('该名称已存在', 'error')
        return
      }
      addFolder(newFolderName.trim(), parentId)
      setNewFolderName('')
      setShowNewFolderInput(null)
    }
  }

  const handleUpdateFolder = () => {
    if (editingFolderId && editingFolderName.trim()) {
      // 获取当前文件夹的parentId
      const getParentId = (folders: RequestFolder[], id: string): string | null => {
        for (const f of folders) {
          for (const c of f.children) {
            if (isFolder(c) && c.id === id) return f.id
          }
          const childFolders = f.children.filter(isFolder) as RequestFolder[]
          const found = getParentId(childFolders, id)
          if (found !== undefined) return found
        }
        return undefined
      }
      // 检查是否在根目录
      const isInRoot = activeProject?.requestFolders.some(f => f.id === editingFolderId)
      const parentId = isInRoot ? null : getParentId(activeProject?.requestFolders || [], editingFolderId) ?? null

      // 检查同一层级是否存在同名文件夹（排除当前文件夹）
      if (checkDuplicateFolderName(editingFolderName.trim(), parentId, editingFolderId)) {
        showToast('该名称已存在', 'error')
        return
      }
      updateFolder(editingFolderId, editingFolderName.trim())
      setEditingFolderId(null)
      setEditingFolderName('')
    }
  }

  const handleUpdateRequestName = () => {
    if (editingRequestId && editingRequestName.trim()) {
      updateSavedRequest(editingRequestId, { name: editingRequestName.trim() })
      setEditingRequestId(null)
      setEditingRequestName('')
    }
  }

  const handleMoveRequest = (targetFolderId: string | null) => {
    if (movingRequestId) {
      const success = moveRequest(movingRequestId, targetFolderId)
      if (!success) {
        showToast('目标位置已存在同名请求', 'error')
      }
      setMovingRequestId(null)
      setMoveMenuPosition(null)
    }
  }

  const handleStartMoveRequest = (id: string | null, element?: HTMLButtonElement | null, contextMenuPos?: { top: number; left: number }) => {
    if (id) {
      const menuWidth = 180
      const menuHeight = 250
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let left: number
      let top: number

      if (element) {
        const rect = element.getBoundingClientRect()
        // 计算位置，紧挨着请求行
        left = rect.right + 4
        top = rect.top

        // 如果右侧空间不足，放在左侧
        if (left + menuWidth > viewportWidth) {
          left = rect.left - menuWidth - 4
        }
      } else if (contextMenuPos) {
        // 从右键菜单调用，使用右键菜单位置
        left = contextMenuPos.left
        top = contextMenuPos.top
      } else {
        // 默认使用屏幕中央
        left = viewportWidth / 2 - menuWidth / 2
        top = viewportHeight / 3
      }

      // 如果下方空间不足，向上调整
      if (top + menuHeight > viewportHeight - 40) {
        top = viewportHeight - menuHeight - 40
      }

      setMovingRequestId(id)
      setMoveMenuPosition({ top, left })
    } else {
      setMovingRequestId(null)
      setMoveMenuPosition(null)
    }
  }

  // 处理请求右键菜单
  const handleRequestContextMenu = (e: React.MouseEvent, request: SavedRequest) => {
    e.preventDefault()
    e.stopPropagation()

    const menuWidth = 160
    const menuHeight = 140
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let left = e.clientX
    let top = e.clientY

    // 如果右侧空间不足，放在左侧
    if (left + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 8
    }

    // 如果下方空间不足，向上调整
    if (top + menuHeight > viewportHeight - 40) {
      top = viewportHeight - menuHeight - 40
    }

    setRequestContextMenu({ id: request.id, top, left })
  }

  // 关闭右键菜单
  useEffect(() => {
    const handleClick = () => {
      setRequestContextMenu(null)
      setFolderContextMenu(null)
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRequestContextMenu(null)
        setFolderContextMenu(null)
      }
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  // 处理文件夹右键菜单
  const handleFolderContextMenu = (e: React.MouseEvent, folder: RequestFolder) => {
    e.preventDefault()
    e.stopPropagation()

    const menuWidth = 160
    const menuHeight = 160
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let left = e.clientX
    let top = e.clientY

    if (left + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 8
    }
    if (top + menuHeight > viewportHeight - 40) {
      top = viewportHeight - menuHeight - 40
    }

    setFolderContextMenu({ id: folder.id, top, left })
  }

  const handleQuickAddRequest = (folderId: string | null) => {
    const newRequest: Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'> = {
      name: '新请求',
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: { type: 'none', content: '', formData: [] },
      auth: { type: 'none' },
    }
    saveRequest(newRequest, folderId)
  }

  const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const today = new Date()
    return date.toDateString() === today.toDateString() ? formatTime(timestamp) : date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  const countRequests = (folders: RequestFolder[], roots: SavedRequest[]): number => {
    let count = roots.length
    for (const f of folders) {
      for (const c of f.children) {
        if (isRequest(c)) count++
        else if (isFolder(c)) count += countRequests([c], [])
      }
    }
    return count
  }

  const findFolderById = (folders: RequestFolder[], id: string): RequestFolder | null => {
    for (const f of folders) {
      if (f.id === id) return f
      const childFolders = f.children.filter(isFolder) as RequestFolder[]
      const found = findFolderById(childFolders, id)
      if (found) return found
    }
    return null
  }

  const getFolderOptions = (folders: RequestFolder[], depth = 0, includeRoot = true): { id: string | null; name: string; depth: number }[] => {
    const result: { id: string | null; name: string; depth: number }[] = includeRoot ? [{ id: null, name: '根目录', depth: 0 }] : []
    for (const f of folders) {
      result.push({ id: f.id, name: f.name, depth: depth + 1 })
      const childFolders = f.children.filter(isFolder) as RequestFolder[]
      if (childFolders.length > 0) result.push(...getFolderOptions(childFolders, depth + 1, false))
    }
    return result
  }

  const findRequestInFolders = (folderList: RequestFolder[], requestId: string): SavedRequest | null => {
    for (const f of folderList) {
      for (const c of f.children) {
        if (isRequest(c) && c.id === requestId) return c
        if (isFolder(c)) { const found = findRequestInFolders([c], requestId); if (found) return found }
      }
    }
    return null
  }

  const isInFolder = (folderList: RequestFolder[], requestId: string): boolean => findRequestInFolders(folderList, requestId) !== null

  const isInSpecificFolder = (folderList: RequestFolder[], requestId: string, folderId: string): boolean => {
    for (const f of folderList) {
      if (f.id === folderId) {
        return f.children.some(c => isRequest(c) && c.id === requestId)
      }
      const childFolders = f.children.filter(isFolder) as RequestFolder[]
      if (isInSpecificFolder(childFolders, requestId, folderId)) return true
    }
    return false
  }

  const checkNameExists = (name: string, folderId: string | null, excludeId?: string): boolean => {
    if (!activeProject) return false
    if (folderId === null) {
      for (const r of activeProject.rootRequests) {
        if (r.id !== excludeId && r.name === name) return true
      }
    }
    const checkFolder = (folders: RequestFolder[]): boolean => {
      for (const f of folders) {
        if (f.id === folderId) {
          return f.children.some(c => isRequest(c) && c.id !== excludeId && c.name === name)
        }
        const childFolders = f.children.filter(isFolder) as RequestFolder[]
        if (checkFolder(childFolders)) return true
      }
      return false
    }
    return folderId !== null && checkFolder(activeProject.requestFolders)
  }

  // 搜索过滤请求
  const filterRequestsBySearch = (folders: RequestFolder[], requests: SavedRequest[], query: string): {
    folders: RequestFolder[]
    requests: SavedRequest[]
  } => {
    if (!query.trim()) return { folders, requests }

    const lowerQuery = query.toLowerCase()

    const filterFolders = (folderList: RequestFolder[]): RequestFolder[] => {
      return folderList.map(f => {
        const filteredChildren = f.children.filter(c => {
          if (isRequest(c)) {
            return c.name.toLowerCase().includes(lowerQuery) || c.url.toLowerCase().includes(lowerQuery)
          }
          return true
        })
        const childFolders = f.children.filter(isFolder)
        const filteredChildFolders = filterFolders(childFolders)
        // 只包含匹配的请求或包含匹配子项的文件夹
        const hasMatchingChildren = filteredChildren.length > 0 || filteredChildFolders.some(cf => cf.children.length > 0)
        if (hasMatchingChildren) {
          return { ...f, children: [...filteredChildren, ...filteredChildFolders] }
        }
        return null
      }).filter((f): f is RequestFolder => f !== null)
    }

    const filteredRequests = requests.filter(r =>
      r.name.toLowerCase().includes(lowerQuery) || r.url.toLowerCase().includes(lowerQuery)
    )

    return { folders: filterFolders(folders), requests: filteredRequests }
  }

  const totalRequests = activeProject ? countRequests(activeProject.requestFolders, activeProject.rootRequests) : 0
  const folderOptions = activeProject ? getFolderOptions(activeProject.requestFolders) : []

  // 应用搜索过滤
  const filteredData = activeProject && searchQuery
    ? filterRequestsBySearch(activeProject.requestFolders, activeProject.rootRequests, searchQuery)
    : { folders: activeProject?.requestFolders || [], requests: activeProject?.rootRequests || [] }

  return (
    <div className="h-full bg-white dark:bg-gray-800 flex flex-col">
      {/* Header */}
      <div className="px-4 h-11 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-white">API Tester</span>
        </div>
        <button
          onClick={() => addProject('新项目')}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
          title="新建项目"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Box */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索请求..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 relative">
        {/* 项目列表 */}
        {projects.map((project) => (
          <div key={project.id} className="border-b border-gray-100 dark:border-gray-700/50">
            {/* 项目标题行 */}
            <div
              onClick={() => {
                switchProject(project.id)
                toggleProject(project.id)
              }}
              className={`group px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                activeProjectId === project.id ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {expandedProjects.has(project.id) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
                <Briefcase className="w-4 h-4 text-blue-500 flex-shrink-0" />
                {editingProjectId === project.id ? (
                  <input
                    type="text"
                    value={editingProjectName}
                    onChange={(e) => setEditingProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateProject(project.id, { name: editingProjectName.trim() })
                        setEditingProjectId(null)
                      }
                      if (e.key === 'Escape') {
                        setEditingProjectId(null)
                      }
                    }}
                    onBlur={() => {
                      if (editingProjectName.trim()) {
                        updateProject(project.id, { name: editingProjectName.trim() })
                      }
                      setEditingProjectId(null)
                    }}
                    className="flex-1 min-w-0 px-2 py-0.5 bg-white dark:bg-gray-700 border border-blue-400 rounded text-sm focus:outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{project.name}</span>
                )}
                <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  {countRequests(project.requestFolders, project.rootRequests)}
                </span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingProjectId(project.id)
                    setEditingProjectName(project.name)
                  }}
                  className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                  title="重命名"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                {projects.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDeleteProject(project.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="删除项目"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 项目内容（展开时） */}
            {expandedProjects.has(project.id) && project.id === activeProjectId && activeProject && (
              <div className="pb-1">
                {/* 环境（在项目内） */}
                <div className="ml-4">
                  <div
                    onClick={() => toggleSection('env-' + project.id)}
                    className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.has('env-' + project.id) ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <Settings className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">环境</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setIsNewEnv(true)
                        setEditingEnv({ id: '', name: '新环境', variables: [] })
                        setShowEnvModal(true)
                      }}
                      className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {expandedSections.has('env-' + project.id) && (
                    <div className="px-2 space-y-0.5">
                      {project.environments.map((env) => (
                        <div
                          key={env.id}
                          onClick={() => setActiveEnv(env.id)}
                          className={`group mx-2 px-3 py-1.5 flex items-center gap-2 cursor-pointer rounded-lg transition-colors ${
                            project.activeEnvId === env.id
                              ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700/70'
                          }`}
                          title={env.variables.length > 0 ? env.variables.filter(v => v.enabled && v.key).map(v => `${v.key}: ${v.value}`).join('\n') : '暂无变量'}
                        >
                          <div className={`w-2 h-2 rounded-full ${project.activeEnvId === env.id ? 'bg-blue-500' : 'bg-gray-300'}`} />
                          <span className={`text-xs flex-1 truncate ${project.activeEnvId === env.id ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                            {env.name}
                          </span>
                          {env.variables.filter(v => v.enabled && v.key).length > 0 && (
                            <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                              {env.variables.filter(v => v.enabled && v.key).length}
                            </span>
                          )}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                            <button onClick={(e) => { e.stopPropagation(); setIsNewEnv(false); setEditingEnv(env); setShowEnvModal(true) }} className="p-0.5 text-gray-400 hover:text-blue-500 rounded">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            {project.environments.length > 1 && (
                              <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteEnv(env.id) }} className="p-0.5 text-gray-400 hover:text-red-500 rounded">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 请求树 */}
                <div className="ml-4">
                  <div
                    onClick={() => toggleSection('req-' + project.id)}
                    className="group px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.has('req-' + project.id) ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">请求</span>
                      <span className="text-xs text-gray-400">
                        {countRequests(activeProject.requestFolders, activeProject.rootRequests)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedSections(prev => { const next = new Set(prev); next.add('req-' + project.id); return next })
                          setShowNewFolderInput('root')
                        }}
                        className="p-1 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded"
                        title="新建文件夹"
                      >
                        <FolderPlus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedSections(prev => { const next = new Set(prev); next.add('req-' + project.id); return next })
                          handleQuickAddRequest(null)
                        }}
                        className="p-1 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded"
                        title="新建请求"
                      >
                        <FilePlus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {expandedSections.has('req-' + project.id) && (
                    <div className="py-1">
                      {/* 新建文件夹输入框（根目录） */}
                      {showNewFolderInput === 'root' && (
                        <div className="flex items-center gap-1 py-1.5 mx-2 px-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                          <Folder className="w-4 h-4 text-amber-500" />
                          <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddFolder(null)
                              if (e.key === 'Escape') { setShowNewFolderInput(null); setNewFolderName('') }
                            }}
                            placeholder="文件夹名称"
                            className="flex-1 px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={() => handleAddFolder(null)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setShowNewFolderInput(null); setNewFolderName('') }} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <RequestTree
                        folders={filteredData.folders}
                        rootRequests={filteredData.requests}
                        expandedFolders={expandedFolders}
                        onToggleFolder={toggleFolder}
                        onSelectRequest={handleSelectRequest}
                        onDeleteRequest={(id) => setConfirmDeleteRequest(id)}
                        onDeleteFolder={(id) => setConfirmDeleteFolder(id)}
                        showNewFolderInput={showNewFolderInput}
                        newFolderName={newFolderName}
                        setNewFolderName={setNewFolderName}
                        onConfirmAddFolder={handleAddFolder}
                        onCancelAddFolder={() => { setShowNewFolderInput(null); setNewFolderName('') }}
                        editingFolderId={editingFolderId}
                        editingFolderName={editingFolderName}
                        setEditingFolderName={setEditingFolderName}
                        onStartEditFolder={(id, name) => { setEditingFolderId(id); setEditingFolderName(name) }}
                        onConfirmEditFolder={handleUpdateFolder}
                        onCancelEditFolder={() => { setEditingFolderId(null); setEditingFolderName('') }}
                        editingRequestId={editingRequestId}
                        editingRequestName={editingRequestName}
                        setEditingRequestName={setEditingRequestName}
                        onStartEditRequest={(id, name) => { setEditingRequestId(id); setEditingRequestName(name) }}
                        onConfirmEditRequest={handleUpdateRequestName}
                        onCancelEditRequest={() => { setEditingRequestId(null); setEditingRequestName('') }}
                        movingRequestId={movingRequestId}
                        onStartMoveRequest={handleStartMoveRequest}
                        onAddFolder={(parentId) => {
                          if (parentId) {
                            setExpandedFolders(prev => { const next = new Set(prev); next.add(parentId); return next })
                          }
                          setShowNewFolderInput(parentId || 'root')
                        }}
                        onAddRequest={(folderId) => {
                          if (folderId) {
                            setExpandedFolders(prev => { const next = new Set(prev); next.add(folderId); return next })
                          }
                          handleQuickAddRequest(folderId)
                        }}
                        requestContextMenu={requestContextMenu}
                        onContextMenu={handleRequestContextMenu}
                        duplicateRequest={duplicateRequest}
                        openTab={openTab}
                        showToast={showToast}
                        folderContextMenu={folderContextMenu}
                        onFolderContextMenu={handleFolderContextMenu}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 历史记录（全局） */}
        <div>
          <div
            onClick={() => toggleSection('history')}
            className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {expandedSections.has('history') ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">历史</span>
              <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{history.length}</span>
            </div>
            {history.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setConfirmClearHistory(true) }} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {expandedSections.has('history') && (
            <div className="pb-1">
              {history.length === 0 ? (
                <div className="px-8 py-4 text-xs text-gray-400 text-center">暂无历史记录</div>
              ) : (
                <div className="px-2 space-y-0.5">
                  {history.slice(0, 20).map((item) => (
                    <div key={item.id} onClick={() => handleSelectHistory(item)} className="group mx-2 px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/70 rounded-lg transition-colors">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${METHOD_BG[item.request.method]} ${METHOD_COLORS[item.request.method]}`}>{item.request.method}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1" title={item.request.url}>{item.request.url}</span>
                      <span className="text-xs text-gray-400">{formatDate(item.timestamp)}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id) }} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 回收站 */}
        {recycleBin.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700/50">
            <div
              onClick={() => toggleSection('recycle-bin')}
              className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSections.has('recycle-bin') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <Archive className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">回收站</span>
                <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{recycleBin.length}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmClearRecycleBin(true)
                }}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {expandedSections.has('recycle-bin') && (
              <div className="pb-1">
                <div className="px-2 space-y-0.5">
                  {recycleBin.map((item) => {
                    const remainingMs = item.expiresAt - Date.now()
                    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60))
                    const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60))
                    const isExpired = remainingMs <= 0

                    return (
                      <div
                        key={item.id}
                        className={`group mx-2 px-3 py-2 flex items-center gap-2 rounded-lg transition-colors ${
                          isExpired
                            ? 'bg-red-50/50 dark:bg-red-900/10'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700/70'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {item.type === 'folder' ? (
                            <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          ) : (
                            <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-600 dark:text-gray-400 truncate" title={item.name}>
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              <span>{item.projectName}</span>
                              <span className="text-gray-300">•</span>
                              <span className={isExpired ? 'text-red-400' : ''}>
                                {isExpired ? '已过期' : `${remainingHours}小时${remainingMinutes}分钟`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => setConfirmRestoreItem(item.id)}
                            className="p-1 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            title="恢复"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmPermanentDeleteItem(item.id)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="永久删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - Import/Export */}
      <div className="flex-shrink-0 h-14 px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
        <button onClick={() => {
          setImportText('')
          setImportMode('new')
          setImportTargetProjectId(null)
          setShowImportExport('import')
        }} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <Download className="w-4 h-4" />
          <span>导入</span>
        </button>
        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />
        <button onClick={() => {
          setSelectedExportProjectId(null)
          setShowImportExport('export')
        }} className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
          <Upload className="w-4 h-4" />
          <span>导出</span>
        </button>
      </div>

      {/* Request Context Menu */}
      {requestContextMenu && createPortal(
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[160px] z-[100] animate-in fade-in-0 zoom-in-95 duration-200"
          style={{ top: requestContextMenu.top, left: requestContextMenu.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            <button
              onClick={() => {
                const req = activeProject?.rootRequests.find(r => r.id === requestContextMenu.id) ||
                  findRequestInFolders(activeProject?.requestFolders || [], requestContextMenu.id)
                if (req) {
                  setEditingRequestId(requestContextMenu.id)
                  setEditingRequestName(req.name || '')
                }
                setRequestContextMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              重命名
            </button>
            <button
              onClick={() => {
                const newRequest = duplicateRequest(requestContextMenu.id)
                if (newRequest) {
                  openTab(newRequest.id)
                  showToast('已复制', 'success')
                }
                setRequestContextMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              复制
            </button>
            <button
              onClick={() => {
                const requestId = requestContextMenu.id
                const pos = { top: requestContextMenu.top, left: requestContextMenu.left }
                setRequestContextMenu(null)
                handleStartMoveRequest(requestId, null, pos)
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Move className="w-4 h-4" />
              移动到
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
            <button
              onClick={() => {
                setConfirmDeleteRequest(requestContextMenu.id)
                setRequestContextMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Folder Context Menu */}
      {folderContextMenu && createPortal(
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[160px] z-[100] animate-in fade-in-0 zoom-in-95 duration-200"
          style={{ top: folderContextMenu.top, left: folderContextMenu.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            <button
              onClick={() => {
                const folder = findFolderById(activeProject?.requestFolders || [], folderContextMenu.id)
                if (folder) {
                  setEditingFolderId(folderContextMenu.id)
                  setEditingFolderName(folder.name)
                }
                setFolderContextMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              重命名
            </button>
            <button
              onClick={() => {
                setExpandedFolders(prev => { const next = new Set(prev); next.add(folderContextMenu.id); return next })
                setShowNewFolderInput(folderContextMenu.id)
                setFolderContextMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              新建子文件夹
            </button>
            <button
              onClick={() => {
                setExpandedFolders(prev => { const next = new Set(prev); next.add(folderContextMenu.id); return next })
                handleQuickAddRequest(folderContextMenu.id)
                setFolderContextMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FilePlus className="w-4 h-4" />
              新建请求
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
            <button
              onClick={() => {
                setConfirmDeleteFolder(folderContextMenu.id)
                setFolderContextMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Move Request Dropdown */}
      {movingRequestId && moveMenuPosition && createPortal(
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => { setMovingRequestId(null); setMoveMenuPosition(null) }} />
          <div className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden min-w-[200px] z-[100] animate-in fade-in-0 zoom-in-95 duration-200" style={{ top: moveMenuPosition.top, left: moveMenuPosition.left }}>
            <div className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50">选择目标文件夹</div>
            <div className="max-h-56 overflow-y-auto py-1">
              {folderOptions.map((opt) => {
                const isCurrentLocation = opt.id === null ? !isInFolder(activeProject?.requestFolders || [], movingRequestId) : isInSpecificFolder(activeProject?.requestFolders || [], movingRequestId, opt.id)
                return (
                  <button
                    key={opt.id || 'root'}
                    onClick={() => { if (!isCurrentLocation) handleMoveRequest(opt.id) }}
                    disabled={isCurrentLocation}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${isCurrentLocation ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50' : 'hover:bg-purple-50 dark:hover:bg-purple-900/30 text-gray-700 dark:text-gray-300'}`}
                    style={{ paddingLeft: `${opt.depth * 16 + 16}px` }}
                  >
                    <Folder className={`w-4 h-4 flex-shrink-0 ${isCurrentLocation ? 'text-gray-300' : 'text-purple-500'}`} />
                    <span className="truncate">{opt.name}</span>
                    {isCurrentLocation && <span className="ml-auto text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">当前</span>}
                  </button>
                )
              })}
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-900/50">
              <button onClick={() => { setMovingRequestId(null); setMoveMenuPosition(null) }} className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">取消</button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Environment Modal */}
      {showEnvModal && editingEnv && (
        <EnvironmentModal environment={editingEnv} isNew={isNewEnv} onClose={() => { setShowEnvModal(false); setEditingEnv(null) }} onSave={(env) => { if (isNewEnv) addEnvironment({ name: env.name, variables: env.variables }); else updateEnvironment(env.id, env); setShowEnvModal(false); setEditingEnv(null) }} />
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog isOpen={!!confirmDeleteEnv} title="删除环境" message={`确定要删除环境"${activeProject?.environments.find(e => e.id === confirmDeleteEnv)?.name}"吗？`} confirmText="删除" cancelText="取消" variant="danger" onConfirm={() => { if (confirmDeleteEnv) deleteEnvironment(confirmDeleteEnv); setConfirmDeleteEnv(null) }} onCancel={() => setConfirmDeleteEnv(null)} />
      <ConfirmDialog
        isOpen={!!confirmDeleteFolder}
        title="删除文件夹"
        message={`确定要删除文件夹"${findFolderById(activeProject?.requestFolders || [], confirmDeleteFolder || '')?.name}"及其所有内容吗？删除的内容将进入回收站，3天内可恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={() => { if (confirmDeleteFolder) deleteFolder(confirmDeleteFolder); setConfirmDeleteFolder(null) }}
        onCancel={() => setConfirmDeleteFolder(null)}
      />
      <ConfirmDialog
        isOpen={!!confirmDeleteRequest}
        title="删除请求"
        message={`确定要删除请求"${(activeProject?.rootRequests.find(r => r.id === confirmDeleteRequest) || findRequestInFolders(activeProject?.requestFolders || [], confirmDeleteRequest || ''))?.name || '未命名'}"吗？删除的内容将进入回收站，3天内可恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={() => { if (confirmDeleteRequest) deleteSavedRequest(confirmDeleteRequest); setConfirmDeleteRequest(null) }}
        onCancel={() => setConfirmDeleteRequest(null)}
      />
      <ConfirmDialog isOpen={!!confirmDeleteProject} title="删除项目" message={`确定要删除项目"${projects.find(p => p.id === confirmDeleteProject)?.name}"吗？该项目下的所有请求和环境都将被删除。`} confirmText="删除" cancelText="取消" variant="danger" onConfirm={() => { if (confirmDeleteProject) { deleteProject(confirmDeleteProject); if (activeProjectId === confirmDeleteProject && projects.length > 1) { switchProject(projects.find(p => p.id !== confirmDeleteProject)?.id || '') } } setConfirmDeleteProject(null) }} onCancel={() => setConfirmDeleteProject(null)} />
      <ConfirmDialog isOpen={confirmClearHistory} title="清空历史" message="确定要清空所有历史记录吗？" confirmText="清空" cancelText="取消" variant="danger" onConfirm={() => { clearHistory(); setConfirmClearHistory(false) }} onCancel={() => setConfirmClearHistory(false)} />

      {/* Recycle Bin Confirm Dialogs */}
      <ConfirmDialog
        isOpen={!!confirmRestoreItem}
        title="恢复项目"
        message={`确定要恢复"${recycleBin.find(i => i.id === confirmRestoreItem)?.name}"吗？将恢复到原位置。`}
        confirmText="恢复"
        cancelText="取消"
        variant="info"
        onConfirm={() => {
          if (confirmRestoreItem) {
            const success = restoreFromRecycleBin(confirmRestoreItem)
            if (success) {
              showToast('已恢复', 'success')
            } else {
              showToast('原位置不存在，已恢复到根目录', 'info')
            }
          }
          setConfirmRestoreItem(null)
        }}
        onCancel={() => setConfirmRestoreItem(null)}
      />
      <ConfirmDialog
        isOpen={!!confirmPermanentDeleteItem}
        title="永久删除"
        message={`确定要永久删除"${recycleBin.find(i => i.id === confirmPermanentDeleteItem)?.name}"吗？此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
        onConfirm={() => {
          if (confirmPermanentDeleteItem) {
            permanentlyDelete(confirmPermanentDeleteItem)
            showToast('已永久删除', 'success')
          }
          setConfirmPermanentDeleteItem(null)
        }}
        onCancel={() => setConfirmPermanentDeleteItem(null)}
      />
      <ConfirmDialog
        isOpen={confirmClearRecycleBin}
        title="清空回收站"
        message="确定要清空回收站吗？所有内容将永久删除且不可恢复。"
        confirmText="清空"
        cancelText="取消"
        variant="danger"
        onConfirm={() => {
          clearRecycleBin()
          showToast('回收站已清空', 'success')
          setConfirmClearRecycleBin(false)
        }}
        onCancel={() => setConfirmClearRecycleBin(false)}
      />

      {/* Import/Export Modal */}
      {showImportExport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={() => setShowImportExport(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{showImportExport === 'export' ? '导出项目' : '导入'}</h3>
              <button onClick={() => setShowImportExport(null)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4">
              {showImportExport === 'export' ? (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">选择要导出的项目</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {projects.map(project => (
                      <label
                        key={project.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                          selectedExportProjectId === project.id
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent'
                        }`}
                        onClick={() => setSelectedExportProjectId(project.id)}
                      >
                        <Briefcase className={`w-4 h-4 ${selectedExportProjectId === project.id ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className={`text-sm font-medium flex-1 ${selectedExportProjectId === project.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {project.name}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                          {countRequests(project.requestFolders, project.rootRequests)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">支持导入项目JSON或OpenAPI 3.0文档</p>

                  {/* 导入方式选择 */}
                  <div className="mb-3">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">导入方式</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setImportMode('new'); setImportTargetProjectId(null) }}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          importMode === 'new'
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        创建新项目
                      </button>
                      <button
                        onClick={() => setImportMode('merge')}
                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                          importMode === 'merge'
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        合并到现有项目
                      </button>
                    </div>
                  </div>

                  {/* 合并时选择目标项目 */}
                  {importMode === 'merge' && (
                    <div className="mb-3">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">目标项目</label>
                      <select
                        value={importTargetProjectId || ''}
                        onChange={(e) => setImportTargetProjectId(e.target.value || null)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">选择项目</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 文件选择按钮 */}
                  <div className="mb-3">
                    <input
                      type="file"
                      accept=".json,.yaml,.yml"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (event) => {
                            const content = event.target?.result as string
                            setImportText(content)
                          }
                          reader.readAsText(file)
                        }
                      }}
                      className="hidden"
                      id="import-file-input"
                    />
                    <label
                      htmlFor="import-file-input"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <Upload className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">选择文件</span>
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 right-0 top-0 flex items-center justify-center pointer-events-none">
                      <span className="text-xs text-gray-400 bg-white dark:bg-gray-800 px-2">或粘贴内容</span>
                    </div>
                    <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder=" " className="w-full h-32 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 flex justify-end gap-3">
              <button onClick={() => setShowImportExport(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">取消</button>
              {showImportExport === 'export' ? (
                <button onClick={() => selectedExportProjectId && handleExport(selectedExportProjectId)} disabled={!selectedExportProjectId} className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">导出</button>
              ) : (
                <button onClick={handleImport} disabled={!importText.trim() || (importMode === 'merge' && !importTargetProjectId)} className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">导入</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// RequestTree component
function RequestTree({
  folders, rootRequests, expandedFolders, onToggleFolder, onSelectRequest, onDeleteRequest, onDeleteFolder,
  showNewFolderInput, newFolderName, setNewFolderName,
  onConfirmAddFolder, onCancelAddFolder, editingFolderId, editingFolderName, setEditingFolderName,
  onStartEditFolder, onConfirmEditFolder, onCancelEditFolder, editingRequestId, editingRequestName,
  setEditingRequestName, onStartEditRequest, onConfirmEditRequest, onCancelEditRequest, movingRequestId,
  onStartMoveRequest, onAddFolder, onAddRequest, depth = 0,
  requestContextMenu, onContextMenu, duplicateRequest, openTab, showToast,
  folderContextMenu, onFolderContextMenu,
}: {
  folders: RequestFolder[]; rootRequests: SavedRequest[]; expandedFolders: Set<string>; onToggleFolder: (id: string) => void;
  onSelectRequest: (request: SavedRequest) => void; onDeleteRequest: (id: string) => void; onDeleteFolder: (id: string) => void;
  showNewFolderInput: string | null; newFolderName: string;
  setNewFolderName: (name: string) => void; onConfirmAddFolder: (parentId: string | null) => void; onCancelAddFolder: () => void;
  editingFolderId: string | null; editingFolderName: string; setEditingFolderName: (name: string) => void;
  onStartEditFolder: (id: string, name: string) => void; onConfirmEditFolder: () => void; onCancelEditFolder: () => void;
  editingRequestId: string | null; editingRequestName: string; setEditingRequestName: (name: string) => void;
  onStartEditRequest: (id: string, name: string) => void; onConfirmEditRequest: () => void; onCancelEditRequest: () => void;
  movingRequestId: string | null; onStartMoveRequest: (id: string | null, element?: HTMLButtonElement | null) => void;
  onAddFolder: (parentId: string | null) => void; onAddRequest: (parentId: string | null) => void; depth?: number;
  requestContextMenu: { id: string; top: number; left: number } | null;
  onContextMenu: (e: React.MouseEvent, request: SavedRequest) => void;
  duplicateRequest: (id: string) => SavedRequest | null;
  openTab: (id: string) => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  folderContextMenu: { id: string; top: number; left: number } | null;
  onFolderContextMenu: (e: React.MouseEvent, folder: RequestFolder) => void;
}) {
  // 计算文件夹内的请求数量
  const countFolderRequests = (folder: RequestFolder): number => {
    let count = 0
    for (const c of folder.children) {
      if (isRequest(c)) count++
      else if (isFolder(c)) count += countFolderRequests(c)
    }
    return count
  }

  return (
    <div className="space-y-0.5">
      {folders.map((folder) => (
        <div key={folder.id}>
          <div
            onClick={() => editingFolderId !== folder.id && onToggleFolder(folder.id)}
            onContextMenu={(e) => onFolderContextMenu(e, folder)}
            className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer rounded-lg mx-2 transition-colors ${
              folderContextMenu?.id === folder.id
                ? 'bg-blue-50 dark:bg-blue-900/30'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
            }`}
            style={{ marginLeft: depth > 0 ? `${depth * 12 + 8}px` : undefined }}
          >
            <button onClick={(e) => { e.stopPropagation(); onToggleFolder(folder.id) }} className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex-shrink-0">
              {expandedFolders.has(folder.id) ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
            </button>
            {expandedFolders.has(folder.id) ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> : <Folder className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
            {editingFolderId === folder.id ? (
              <div className="flex-1 min-w-0 flex items-center gap-1 bg-white dark:bg-gray-700 rounded px-1.5 py-0.5 shadow-sm border border-blue-400 dark:border-blue-500">
                <input type="text" value={editingFolderName} onChange={(e) => setEditingFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onConfirmEditFolder(); if (e.key === 'Escape') onCancelEditFolder() }} placeholder="输入名称..." className="flex-1 min-w-0 bg-transparent text-sm text-gray-800 dark:text-gray-200 focus:outline-none" autoFocus onClick={(e) => e.stopPropagation()} />
                <button onClick={(e) => { e.stopPropagation(); onConfirmEditFolder() }} className="p-0.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded flex-shrink-0"><Check className="w-3 h-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); onCancelEditFolder() }} className="p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded flex-shrink-0"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <>
                <span className="flex-1 min-w-0 text-sm text-gray-700 dark:text-gray-300 truncate" title={folder.name}>{folder.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-1">{countFolderRequests(folder)}</span>
              </>
            )}
          </div>
          {expandedFolders.has(folder.id) && (
            <div>
              {showNewFolderInput === folder.id && (
                <div className="flex items-center gap-1 py-1.5 mx-2 px-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg" style={{ marginLeft: `${(depth + 1) * 12 + 8}px` }}>
                  <Folder className="w-4 h-4 text-amber-500" />
                  <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onConfirmAddFolder(folder.id); if (e.key === 'Escape') onCancelAddFolder() }} placeholder="文件夹名称" className="flex-1 px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
                  <button onClick={() => onConfirmAddFolder(folder.id)} className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"><Plus className="w-3.5 h-3.5" /></button>
                  <button onClick={onCancelAddFolder} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <RequestTree folders={folder.children.filter(isFolder) as RequestFolder[]} rootRequests={folder.children.filter(isRequest) as SavedRequest[]} expandedFolders={expandedFolders} onToggleFolder={onToggleFolder} onSelectRequest={onSelectRequest} onDeleteRequest={onDeleteRequest} onDeleteFolder={onDeleteFolder} showNewFolderInput={showNewFolderInput} newFolderName={newFolderName} setNewFolderName={setNewFolderName} onConfirmAddFolder={onConfirmAddFolder} onCancelAddFolder={onCancelAddFolder} editingFolderId={editingFolderId} editingFolderName={editingFolderName} setEditingFolderName={setEditingFolderName} onStartEditFolder={onStartEditFolder} onConfirmEditFolder={onConfirmEditFolder} onCancelEditFolder={onCancelEditFolder} editingRequestId={editingRequestId} editingRequestName={editingRequestName} setEditingRequestName={setEditingRequestName} onStartEditRequest={onStartEditRequest} onConfirmEditRequest={onConfirmEditRequest} onCancelEditRequest={onCancelEditRequest} movingRequestId={movingRequestId} onStartMoveRequest={onStartMoveRequest} onAddFolder={onAddFolder} onAddRequest={onAddRequest} depth={depth + 1} requestContextMenu={requestContextMenu} onContextMenu={onContextMenu} duplicateRequest={duplicateRequest} openTab={openTab} showToast={showToast} folderContextMenu={folderContextMenu} onFolderContextMenu={onFolderContextMenu} />
            </div>
          )}
        </div>
      ))}
      {rootRequests.map((request) => (
        <div
          key={request.id}
          onClick={() => movingRequestId !== request.id && onSelectRequest(request)}
          onContextMenu={(e) => onContextMenu(e, request)}
          className={`px-2 py-1.5 flex items-center gap-2 cursor-pointer rounded-lg transition-colors ${
            movingRequestId === request.id
              ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500 mx-2'
              : requestContextMenu?.id === request.id
                ? 'bg-blue-50 dark:bg-blue-900/30 mx-2'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700/70 mx-2'
          }`}
          style={{ marginLeft: depth > 0 ? `${depth * 12 + 8}px` : undefined }}
        >
          <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${METHOD_BG[request.method]} ${METHOD_COLORS[request.method]}`}>{request.method}</span>
          {editingRequestId === request.id ? (
            <div className="flex-1 min-w-0 flex items-center gap-1 bg-white dark:bg-gray-700 rounded px-1.5 py-0.5 shadow-sm border border-blue-400 dark:border-blue-500">
              <input type="text" value={editingRequestName} onChange={(e) => setEditingRequestName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onConfirmEditRequest(); if (e.key === 'Escape') onCancelEditRequest() }} placeholder="输入名称..." className="flex-1 min-w-0 bg-transparent text-sm text-gray-800 dark:text-gray-200 focus:outline-none" autoFocus onClick={(e) => e.stopPropagation()} />
              <button onClick={(e) => { e.stopPropagation(); onConfirmEditRequest() }} className="p-0.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30 rounded flex-shrink-0"><Check className="w-3 h-3" /></button>
              <button onClick={(e) => { e.stopPropagation(); onCancelEditRequest() }} className="p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded flex-shrink-0"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1" title={request.name || request.url}>{request.name || request.url}</span>
          )}
        </div>
      ))}
      {folders.length === 0 && rootRequests.length === 0 && depth === 0 && (
        <div className="px-8 py-4 text-xs text-gray-400 text-center">暂无请求，点击上方按钮创建</div>
      )}
    </div>
  )
}

// Environment Modal Component
function EnvironmentModal({ environment, isNew, onClose, onSave }: { environment: Environment; isNew: boolean; onClose: () => void; onSave: (env: Environment) => void }) {
  const { showToast } = useToast()
  const [name, setName] = useState(environment.name)
  const [variables, setVariables] = useState<KeyValue[]>(environment.variables)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{isNew ? '新建环境' : '编辑环境'}</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">环境名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：开发环境" className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" autoFocus />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">变量</label>
              <button onClick={() => setVariables([...variables, { key: '', value: '', enabled: true }])} className="text-xs text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"><Plus className="w-3 h-3" />添加</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {variables.length === 0 ? (
                <div className="py-4 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">暂无变量</div>
              ) : (
                variables.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <input type="checkbox" checked={v.enabled} onChange={(e) => { const newVars = [...variables]; newVars[i] = { ...newVars[i], enabled: e.target.checked }; setVariables(newVars) }} className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500" />
                    <input type="text" value={v.key} onChange={(e) => { const newVars = [...variables]; newVars[i] = { ...newVars[i], key: e.target.value }; setVariables(newVars) }} placeholder="变量名" className="flex-1 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                    <input type="text" value={v.value} onChange={(e) => { const newVars = [...variables]; newVars[i] = { ...newVars[i], value: e.target.value }; setVariables(newVars) }} placeholder="值" className="flex-1 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
                    <button onClick={() => setVariables(variables.filter((_, idx) => idx !== i))} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">取消</button>
          <button onClick={() => { if (!name.trim()) { showToast('请输入名称', 'error'); return } onSave({ ...environment, name, variables }) }} className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm">保存</button>
        </div>
      </div>
    </div>
  )
}