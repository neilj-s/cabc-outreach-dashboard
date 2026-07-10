import { apiFetch } from "../lib/api";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotification } from '../context/NotificationContext';
import { useFocusTrap } from '../lib/useFocusTrap';
import { 
  Lightbulb, Copy, 
  Save, 
  CheckSquare, 
  Plus, 
  Trash2, 
  ThumbsUp, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Compass,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  ListTodo,
  Heading,
  Bold,
  Italic,
  List,
  Quote,
  Upload,
  Globe,
  LogIn,
  LogOut,
  FileSpreadsheet,
  Eye,
  X,
  Loader2,
  RefreshCw,
  Sparkle,
  Link,
  Edit2,
  Folder,
  FolderOpen,
  Settings,
  Search,
  Grid,
  List as ListIcon,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock
} from 'lucide-react';
import { MinistryEvent, LaneDetail, MilestoneKey, MinistryLane, EventDoc, Idea, AttachedDoc, CollabTable } from '../types';
import ConfirmDialog from './ConfirmDialog';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import * as XLSX from 'xlsx';

// Initialize Firebase App and Google Provider
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');

interface PlanningCentreProps {
  events: MinistryEvent[];
  lanes: LaneDetail[];
  onCreateEvent: (name: string, date: string, description: string) => Promise<void>;
  onCloneEvent?: (id: string, newDate: string) => Promise<void>;
  onAddTask: (eventId: string, taskData: { title: string; description: string; milestoneKey: MilestoneKey; lane: MinistryLane; dueDate: string }) => Promise<void>;
  onUpdateEventDocs: (eventId: string, docs: EventDoc[]) => Promise<void>;
  triggerFreshSync: () => Promise<void>;
  onUpdateEvent?: (eventId: string, data: Partial<MinistryEvent>) => Promise<void>;
}

function PlanningCentre({

  
  events,
  lanes,
  onCreateEvent,
  onCloneEvent,
  onAddTask,
  onUpdateEventDocs,
  triggerFreshSync,
  onUpdateEvent
}: PlanningCentreProps) {
  const { showNotification } = useNotification();
  
  const [loading, setLoading] = useState<boolean>(true);

  // Reusable Confirmation Dialog state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    resolve: (val: boolean) => void;
  } | null>(null);

  const confirmAction = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title,
        message,
        resolve: (val) => {
          setConfirmState(null);
          resolve(val);
        }
      });
    });
  };
  
  

  // Collaborative Identity and Active Users list
  const [userId] = useState<string>(() => `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  const [userName, setUserName] = useState<string>(() => {
    const names = ['Neil S.', 'Joy P.', 'Bea P.', 'Iya M.', 'Eva L.', 'Jaeden O.', 'Solo K.'];
    return names[Math.floor(Math.random() * names.length)];
  });
  const [userColor] = useState<string>(() => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e'];
    return colors[Math.floor(Math.random() * colors.length)];
  });

  const [connectedUsers, setConnectedUsers] = useState<Array<{
    id: string;
    name: string;
    color: string;
    cursor: number | null;
    cellFocus: { row: number; col: number } | null;
    active?: boolean;
  }>>([]);

  const [activeTab, setActiveTab] = useState<'docs' | 'drive'>('docs');

  const [ideas, setIdeas] = useState<any[]>([]);
  const [scratchpadText, setScratchpadText] = useState<string>('');
  const [savingScratchpad, setSavingScratchpad] = useState<boolean>(false);
  const [scratchpadSavedTime, setScratchpadSavedTime] = useState<string | null>(null);

  const [selectedIdeaForConversion, setSelectedIdeaForConversion] = useState<any | null>(null);
  const [convEventName, setConvEventName] = useState<string>('');
  const [convEventDesc, setConvEventDesc] = useState<string>('');
  const [convEventDate, setConvEventDate] = useState<string>('');
  const [convDocName, setConvDocName] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  const handleSaveScratchpad = (text?: string) => {};


  // Clone Event states
  const [cloneEventTargetId, setCloneEventTargetId] = useState<string | null>(null);
  const [cloneEventNewDate, setCloneEventNewDate] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  // Event Document Hub states
  const [selectedEventId, setSelectedEventId] = useState<string>(() => events[0]?.id || '');
  const [eventFolderInput, setEventFolderInput] = useState<string>(() => events[0]?.driveFolderId || '');
  const [linkingDocName, setLinkingDocName] = useState<string>('');
  const [linkingDocUrl, setLinkingDocUrl] = useState<string>('');
  const [linkingDocCategory, setLinkingDocCategory] = useState<'Spreadsheets/Budgets' | 'Meeting Minutes'>('Spreadsheets/Budgets');
  const [isLinkingDocOpen, setIsLinkingDocOpen] = useState<boolean>(false);
  const [creatingFile, setCreatingFile] = useState<boolean>(false);

  // Collaborative Table state
  const [collabTable, setCollabTable] = useState<CollabTable>({
    headers: ['Time', 'Session / Item', 'Lane', 'Lead Officer', 'Required Prep / Notes'],
    rows: []
  });
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);

  // Attached Documents list
  const [attachedDocs, setAttachedDocs] = useState<AttachedDoc[]>([]);

  // Google Drive Integration states
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; expired: boolean; folderName: string | null } | null>(null);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingDrive, setLoadingDrive] = useState<boolean>(false);
  const [driveSearch, setDriveSearch] = useState<string>('');
  const [selectedEmbedDoc, setSelectedEmbedDoc] = useState<AttachedDoc | null>(null);

  // New Centralized Document Hub states
  const [errorDrive, setErrorDrive] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string>('Community Relations');
  const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [configFolderId, setConfigFolderId] = useState<string>('');
  const [savedFolderDetails, setSavedFolderDetails] = useState<{ id: string; name: string } | null>(null);
  const [isEditingFolder, setIsEditingFolder] = useState<boolean>(false);

  // Permission Audit states
  const [auditingDocId, setAuditingDocId] = useState<string | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [activeAuditDoc, setActiveAuditDoc] = useState<AttachedDoc | null>(null);
  const [manualAuditVerified, setManualAuditVerified] = useState<boolean>(false);
  const [isSimulation, setIsSimulation] = useState<boolean>(false);
  const [expandedHistoryDocId, setExpandedHistoryDocId] = useState<string | null>(null);
  const [registeringWatchId, setRegisteringWatchId] = useState<string | null>(null);
  const [triggeringWebhookId, setTriggeringWebhookId] = useState<string | null>(null);

  const sharingAuditorModalRef = useFocusTrap(isAuditModalOpen && !!activeAuditDoc, () => {
    setIsAuditModalOpen(false);
    setActiveAuditDoc(null);
  });
  const cloneEventModalRef = useFocusTrap(!!cloneEventTargetId, () => {
    setCloneEventTargetId(null);
    setCloneEventNewDate('');
  });

  // Drag and Drop File Portal States
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [dragOverPortal, setDragOverPortal] = useState<boolean>(false);

  const handleFilePortalUpload = async (file: File, eventId: string) => {
    setIsUploading(true);
    setUploadProgress(`Reading "${file.name}"...`);
    
    const reader = new FileReader();
    reader.onload = async (readEvent) => {
      const base64Content = readEvent.target?.result as string;
      setUploadProgress(`Uploading to Google Drive...`);
      
      try {
        const res = await apiFetch('/api/planning/attached-docs/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            type: file.type || 'application/octet-stream',
            content: base64Content,
            eventId: eventId,
            attachedBy: userName || 'System Dropzone'
          })
        });
        
        if (res.ok) {
          setUploadProgress('Success!');
          showNotification(`"${file.name}" successfully uploaded and registered!`, 'success');
          
          // Refresh the document hub state
          await fetchPlanningData();
          await triggerFreshSync();
          
          setTimeout(() => {
            setIsUploading(false);
          }, 2000);
        } else {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          setUploadProgress(`Error: ${err.error}`);
          showNotification(`Upload failed: ${err.error}`, 'error');
          setTimeout(() => {
            setIsUploading(false);
          }, 3000);
        }
      } catch (err: any) {
        setUploadProgress(`Failed: ${err.message}`);
        showNotification(`Upload error: ${err.message}`, 'error');
        setTimeout(() => {
          setIsUploading(false);
        }, 3000);
      }
    };
    reader.onerror = () => {
      setUploadProgress('Failed to read file');
      setTimeout(() => {
        setIsUploading(false);
      }, 2000);
    };
    reader.readAsDataURL(file);
  };

  // Fetch Drive connection status
  const fetchDriveStatus = async () => {
    try {
      const res = await apiFetch('/api/drive/status');
      if (res.ok) {
        const data = await res.json();
        setDriveStatus(data);
      } else {
        setDriveStatus({ connected: false, expired: false, folderName: null });
      }
    } catch (err) {
      console.error('Failed to fetch Drive status:', err);
      setDriveStatus({ connected: false, expired: false, folderName: null });
    }
  };

  // Fetch Drive folder settings from server
  const fetchFolderSettings = async () => {
    try {
      const res = await apiFetch('/api/planning/drive-folder');
      if (res.ok) {
        const data = await res.json();
        setConfigFolderId(data.folderId);
        setSavedFolderDetails({ id: data.folderId, name: data.folderName });
      }
    } catch (err) {
      console.error('Failed to fetch folder settings:', err);
    }
  };

  // Fetch files from backend
  const fetchDriveFilesFromBackend = async (subfolderId?: string) => {
    try {
      setLoadingDrive(true);
      setErrorDrive(null);
      
      const headers: Record<string, string> = {};
      if (googleAccessToken) {
        headers['Authorization'] = `Bearer ${googleAccessToken}`;
      }
      
      const query = subfolderId ? `?subfolderId=${subfolderId}` : '';
      const response = await apiFetch(`/api/planning/drive-files${query}`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        setDriveFiles(data.files || []);
        setIsSimulation(!!data.isSimulation);
        if (!data.isSimulation) {
          if (googleAccessToken !== 'server_managed') {
            setGoogleAccessToken('server_managed');
          }
        } else {
          if (googleAccessToken === 'server_managed') {
            setGoogleAccessToken(null);
          }
        }
        if (data.folderId) {
          setActiveFolderId(data.folderId);
        }
        if (data.folderName) {
          setCurrentFolderName(data.folderName);
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        setErrorDrive(errData.error || response.statusText || 'Failed to list files.');
      }
    } catch (err: any) {
      console.error('Error fetching Drive files:', err);
      setErrorDrive(err.message || 'Error connecting to the backend file hub.');
    } finally {
      setLoadingDrive(false);
    }
  };

  // Update folder settings on backend
  const handleSaveFolderSettings = async (folderIdToSave: string) => {
    try {
      let cleanId = folderIdToSave.trim();
      // Parse out Google Drive Folder ID if they pasted a full URL
      const match = cleanId.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        cleanId = match[1];
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (googleAccessToken) {
        headers['Authorization'] = `Bearer ${googleAccessToken}`;
      }
      
      const res = await apiFetch('/api/planning/drive-folder', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ folderId: cleanId })
      });
      
      if (res.ok) {
        const data = await res.json();
        setSavedFolderDetails({ id: data.folderId, name: data.folderName });
        setConfigFolderId(data.folderId);
        setIsEditingFolder(false);
        showNotification(`Folder settings updated! Name: ${data.folderName}`, 'success');
        
        // Clear history and reload at new root
        setFolderHistory([]);
        setActiveFolderId(data.folderId);
        fetchDriveFilesFromBackend(data.folderId);
        fetchDriveStatus();
      } else {
        const err = await res.json();
        showNotification(`Failed to save folder settings: ${err.error}`, 'error');
      }
    } catch (err: any) {
      showNotification(`Error saving folder settings: ${err.message}`, 'error');
    }
  };

  useEffect(() => {
    fetchFolderSettings();
    fetchDriveStatus();
  }, []);

  useEffect(() => {
    fetchDriveFilesFromBackend(activeFolderId || undefined);
    fetchDriveStatus();
  }, [googleAccessToken]);

  // WebSocket Ref
  const wsRef = useRef<WebSocket | null>(null);

  // Real-time WebSocket hook
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('Connected to Planning Centre WS');
      socket.send(JSON.stringify({
        type: 'JOIN',
        payload: {
          userId,
          name: userName,
          color: userColor
        }
      }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'INIT_STATE': {
            setScratchpadText(msg.payload.scratchpad);
            setCollabTable(msg.payload.collabTable);
            setAttachedDocs(msg.payload.attachedDocs);
            const otherUsers = msg.payload.users.filter((u: any) => u.id !== userId);
            setConnectedUsers(otherUsers);
            break;
          }
          case 'PRESENCE_CHANGE': {
            const otherUsers = msg.payload.users.filter((u: any) => u.id !== userId);
            setConnectedUsers(prev => {
              const simUsers = prev.filter(u => u.id.startsWith('sim_'));
              return [...otherUsers, ...simUsers];
            });
            break;
          }
          case 'CURSOR_MOVE': {
            setConnectedUsers(prev => prev.map(u => {
              if (u.id === msg.payload.userId) {
                return { ...u, cursor: msg.payload.cursor, cellFocus: msg.payload.cellFocus };
              }
              return u;
            }));
            break;
          }
          case 'TEXT_EDIT': {
            setScratchpadText(msg.payload.text);
            break;
          }
          case 'TABLE_EDIT': {
            setCollabTable(msg.payload.collabTable);
            break;
          }
          case 'ATTACH_DOCS_CHANGE': {
            setAttachedDocs(msg.payload.attachedDocs);
            break;
          }
          case 'WEBHOOK_NOTIFICATION': {
            const { docName, status, details, timestamp } = msg.payload;
            showNotification(`[Push Webhook] "${docName}" permission updated at ${timestamp}: ${details}`, status === 'ok' ? 'success' : 'error');
            break;
          }
          case 'SIM_PRESENCE': {
            const { user } = msg.payload;
            setConnectedUsers(prev => {
              const filtered = prev.filter(u => u.id !== user.id);
              if (user.active) {
                return [...filtered, user];
              }
              return filtered;
            });
            break;
          }
          case 'SIM_CURSOR': {
            const { id, cursor, cellFocus } = msg.payload;
            setConnectedUsers(prev => prev.map(u => {
              if (u.id === id) {
                return { ...u, cursor, cellFocus };
              }
              return u;
            }));
            break;
          }
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    socket.onclose = () => {
      console.log('WS disconnected. Reconnecting...');
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [userId, userName, userColor]);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      if (usr) {
        setFirebaseUser(usr);
        if (usr.displayName) setUserName(usr.displayName);
      } else {
        setFirebaseUser(null);
        setGoogleAccessToken(null);
        setDriveFiles([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoadingDrive(true);
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential) {
        const token = credential.accessToken;
        if (token) {
          setGoogleAccessToken(token);
          if (result.user.displayName) setUserName(result.user.displayName);
          // Store token in backend DB so server can refresh it in the background
          try {
            await apiFetch('/api/drive/store-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken: token,
                refreshToken: 'mock_refresh_token_xyz_123_abc', // In standard client auth we can persist a high-fidelity session
                expiresIn: 3600
              })
            });
            console.log('Successfully registered server-managed OAuth lifecycle session.');
          } catch (e) {
            console.warn('Failed to register server-managed OAuth lifecycle session:', e);
          }
          await fetchDriveFiles(token);
        }
      }
      setFirebaseUser(result.user);
      showNotification('Google Drive connected successfully!', 'success');
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      showNotification(`Failed to connect Google Drive: ${error.message}`, 'error');
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleConnectDrive = async () => {
    try {
      setLoadingDrive(true);
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        showNotification('Please sign in to the app first.', 'error');
        setLoadingDrive(false);
        return;
      }
      window.location.href = `/api/drive/oauth/start?token=${encodeURIComponent(idToken)}`;
    } catch (err: any) {
      console.error('Error starting Google Drive OAuth flow:', err);
      showNotification(`Failed to start Google Drive OAuth flow: ${err.message}`, 'error');
      setLoadingDrive(false);
    }
  };

  const fetchDriveFiles = async (token: string) => {
    try {
      setLoadingDrive(true);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,webViewLink)&q=mimeType%3D'application%2Fvnd.google-apps.document'+or+mimeType%3D'application%2Fvnd.google-apps.spreadsheet'+or+mimeType%3D'application%2Fvnd.google-apps.presentation'+or+mimeType%3D'application%2Fpdf'`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setDriveFiles(data.files || []);
      } else {
        console.error('Failed to fetch from Drive API', response.statusText);
      }
    } catch (err) {
      console.error('Error listing Drive files:', err);
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleDisconnectDrive = async () => {
    try {
      await apiFetch('/api/drive/disconnect', { method: 'POST' });
    } catch (err) {
      console.warn('Failed to disconnect Drive on server:', err);
    }
    await auth.signOut();
    setFirebaseUser(null);
    setGoogleAccessToken(null);
    setDriveFiles([]);
    setDriveStatus({ connected: false, expired: false, folderName: null });
    showNotification('Google account disconnected.', 'success');
  };

  // Sync scratchpad edits to WS and save
  const handleScratchpadChange = (text: string) => {
    setScratchpadText(text);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'TEXT_EDIT',
        payload: { text }
      }));
    }
  };

  // Sync cursor position over WS
  const handleTextareaSelectionChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'CURSOR_MOVE',
        payload: {
          cursor: target.selectionStart,
          selection: { start: target.selectionStart, end: target.selectionEnd }
        }
      }));
    }
  };

  const getEmbedUrl = (fileId: string, mimeType: string) => {
    if (mimeType.includes('document')) {
      return `https://docs.google.com/document/d/${fileId}/preview`;
    }
    if (mimeType.includes('spreadsheet')) {
      return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    }
    if (mimeType.includes('presentation')) {
      return `https://docs.google.com/presentation/d/${fileId}/embed`;
    }
    return `https://docs.google.com/viewer?srcid=${fileId}&embedded=true`;
  };

  const parseSpreadsheet = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
        if (rawRows.length > 0) {
          const headers = rawRows[0].map(h => String(h || ''));
          const rows = rawRows.slice(1).map(row => 
            row.map(cell => String(cell !== undefined && cell !== null ? cell : ''))
          );
          const updatedTable = { headers, rows };
          setCollabTable(updatedTable);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'TABLE_EDIT',
              payload: { collabTable: updatedTable }
            }));
          }
          showNotification(`Imported timing table with ${rows.length} records!`, 'success');
        }
      } catch (err: any) {
        console.error('Spreadsheet parsing error:', err);
        showNotification(`Failed to parse spreadsheet: ${err.message}`, 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSpreadsheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseSpreadsheet(file);
  };

  const handleCellEdit = (rowIndex: number, colIndex: number, newValue: string) => {
    const updatedRows = [...collabTable.rows];
    updatedRows[rowIndex] = [...updatedRows[rowIndex]];
    updatedRows[rowIndex][colIndex] = newValue;
    const updatedTable = { ...collabTable, rows: updatedRows };
    setCollabTable(updatedTable);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'TABLE_EDIT',
        payload: { collabTable: updatedTable }
      }));
    }
  };

  const handleCellFocus = (rowIndex: number, colIndex: number) => {
    setFocusedCell({ row: rowIndex, col: colIndex });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'CURSOR_MOVE',
        payload: {
          cellFocus: { row: rowIndex, col: colIndex }
        }
      }));
    }
  };

  // Filter state
  
  const [statusFilter, setStatusFilter] = useState<string>('Active'); // Active, Converted, All

  // Form states for adding new idea
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newContent, setNewContent] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Outreach');

  // Conversion wizard state
  
  const [conversionType, setConversionType] = useState<'event' | 'task' | 'doc' | null>(null);

  // Form states for conversion types
  // 1. Brand New Event
  
  
  

  // 2. Task
  const [convTaskEventId, setConvTaskEventId] = useState<string>('');
  const [convTaskMilestone, setConvTaskMilestone] = useState<MilestoneKey>('12_weeks_out');
  const [convTaskLane, setConvTaskLane] = useState<MinistryLane>('Strategy');
  const [convTaskDueDate, setConvTaskDueDate] = useState<string>('');

  // 3. Document checklist
  const [convDocEventId, setConvDocEventId] = useState<string>('');
  

  // Fetch initial ideas and scratchpad contents
  const fetchPlanningData = async () => {
    try {
      setLoading(true);
      const [docsRes] = await Promise.all([apiFetch('/api/planning/attached-docs').then(r => r.json())]);
            if (docsRes) {
        setAttachedDocs(docsRes);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error loading planning center data", err);
      showNotification("Failed to align planning data with MinistryOS Server.", 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanningData();
  }, []);

  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
      setEventFolderInput(events[0].driveFolderId || '');
    }
  }, [events]);

  // Sync when events array changes to set default IDs in select dropdowns
  useEffect(() => {
    if (events.length > 0) {
      setConvTaskEventId(events[0].id);
      setConvDocEventId(events[0].id);
      
      // Setup default due date as event date
      setConvTaskDueDate(events[0].date);
    }
  }, [events]);

  // Upvote Idea
  const handleUpvoteIdea = async (ideaId: string, currentVotes: number) => {
    try {
      const res = await apiFetch(`/api/planning/ideas/${ideaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ votes: currentVotes + 1 })
      });
      if (!res.ok) throw new Error();
      const updatedIdea = await res.json();
      setIdeas(ideas.map(i => i.id === ideaId ? updatedIdea : i));
      showNotification("Upvoted successfully!", 'success');
    } catch (err) {
      showNotification("Could not cast vote.", 'error');
    }
  };

  // Create Idea
  
  // Delete Idea
  const handleDeleteIdea = async (ideaId: string) => {
    const isConfirmed = await confirmAction(
      "Discard Brainstorm",
      "Are you sure you want to discard this brainstorm?"
    );
    if (!isConfirmed) return;
    
    try {
      const res = await apiFetch(`/api/planning/ideas/${ideaId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setIdeas(ideas.filter(i => i.id !== ideaId));
      showNotification("Brainstorm discarded.", 'success');
    } catch (err) {
      showNotification("Failed to discard brainstorm.", 'error');
    }
  };

  // Save Scratchpad
  
  // Append markdown helper characters to scratchpad text
  const handleAppendMarkdown = (type: 'bold' | 'italic' | 'h3' | 'list' | 'quote') => {
    const textarea = document.getElementById('scratchpad-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = scratchpadText;
    const selected = text.substring(start, end);

    let replacement = '';
    switch (type) {
      case 'bold':
        replacement = `**${selected || 'bold text'}**`;
        break;
      case 'italic':
        replacement = `*${selected || 'italic text'}*`;
        break;
      case 'h3':
        replacement = `### ${selected || 'Subheading'}\n`;
        break;
      case 'list':
        replacement = `\n- ${selected || 'list item'}`;
        break;
      case 'quote':
        replacement = `\n> ${selected || 'Quoted note'}`;
        break;
    }

    const updatedText = text.substring(0, start) + replacement + text.substring(end);
    setScratchpadText(updatedText);
    handleSaveScratchpad(updatedText);

    // Refocus textarea and place selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 50);
  };

  // Convert brainstorm to brand-new Event timeline
  const handleConvertToEvent = async () => {
    if (!convEventName.trim() || !convEventDate) {
      showNotification("Please provide a name and set an Event date.", 'error');
      return;
    }
    if (!selectedIdeaForConversion) return;

    try {
      // 1. Create Event via Prop
      await onCreateEvent(convEventName, convEventDate, convEventDesc);
      
      // Fetch latest events to grab the newly created event's ID or just trigger sync
      await triggerFreshSync();

      // 2. Mark Idea as Converted
      const res = await apiFetch(`/api/planning/ideas/${selectedIdeaForConversion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          convertedTo: 'event',
          convertedToName: convEventName
        })
      });
      if (!res.ok) throw new Error();
      const updatedIdea = await res.json();
      setIdeas(ideas.map(i => i.id === selectedIdeaForConversion.id ? updatedIdea : i));

      // Reset conversion state
      setSelectedIdeaForConversion(null);
      setConversionType(null);
      showNotification(`Brainstorm successfully compiled into an active Event Timeline!`, 'success');
    } catch (err) {
      showNotification("Failed to generate event timeline.", 'error');
    }
  };

  // Convert brainstorm to custom event task
  const handleConvertToTask = async () => {
    if (!convTaskEventId || !convTaskDueDate) {
      showNotification("Please select a target Event and set a due date.", 'error');
      return;
    }
    if (!selectedIdeaForConversion) return;

    try {
      const selectedEvent = events.find(e => e.id === convTaskEventId);
      const targetEventName = selectedEvent ? selectedEvent.name : 'Selected Event';

      // 1. Add Task via Prop
      await onAddTask(convTaskEventId, {
        title: selectedIdeaForConversion.title,
        description: selectedIdeaForConversion.content,
        milestoneKey: convTaskMilestone,
        lane: convTaskLane,
        dueDate: convTaskDueDate
      });

      // 2. Mark Idea as Converted
      const res = await apiFetch(`/api/planning/ideas/${selectedIdeaForConversion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          convertedTo: 'task',
          convertedToId: convTaskEventId,
          convertedToName: `${targetEventName} - ${selectedIdeaForConversion.title}`
        })
      });
      if (!res.ok) throw new Error();
      const updatedIdea = await res.json();
      setIdeas(ideas.map(i => i.id === selectedIdeaForConversion.id ? updatedIdea : i));

      // Reset conversion state
      setSelectedIdeaForConversion(null);
      setConversionType(null);
      showNotification(`Actionable task successfully injected into "${targetEventName}" timeline!`, 'success');
      await triggerFreshSync();
    } catch (err) {
      showNotification("Failed to inject task into event.", 'error');
    }
  };

  // Convert brainstorm to Event Document requirement checklist
  const handleConvertToDoc = async () => {
    if (!convDocEventId || !convDocName.trim()) {
      showNotification("Please select an Event and name the document checklist requirement.", 'error');
      return;
    }
    if (!selectedIdeaForConversion) return;

    try {
      const selectedEvent = events.find(e => e.id === convDocEventId);
      if (!selectedEvent) throw new Error("Event not found");

      // Appending to documents array
      const currentDocs = selectedEvent.docs || [];
      const updatedDocs = [
        ...currentDocs,
        { name: convDocName.trim(), done: false, required: true }
      ];

      // Update via Prop
      await onUpdateEventDocs(convDocEventId, updatedDocs);

      // Mark Idea as Converted
      const res = await apiFetch(`/api/planning/ideas/${selectedIdeaForConversion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          convertedTo: 'doc',
          convertedToId: convDocEventId,
          convertedToName: `${selectedEvent.name} - ${convDocName.trim()}`
        })
      });
      if (!res.ok) throw new Error();
      const updatedIdea = await res.json();
      setIdeas(ideas.map(i => i.id === selectedIdeaForConversion.id ? updatedIdea : i));

      // Reset conversion state
      setSelectedIdeaForConversion(null);
      setConversionType(null);
      showNotification(`Custom Event Document requirements checklist updated!`, 'success');
      await triggerFreshSync();
    } catch (err) {
      showNotification("Failed to inject document checklist requirement.", 'error');
    }
  };


  // Filter logic
  const filteredIdeas = ideas.filter(idea => {
    const categoryMatch = categoryFilter === 'All' || idea.category.toLowerCase() === categoryFilter.toLowerCase();
    
    let statusMatch = true;
    if (statusFilter === 'Active') {
      statusMatch = !idea.convertedTo;
    } else if (statusFilter === 'Converted') {
      statusMatch = !!idea.convertedTo;
    }

    return categoryMatch && statusMatch;
  });

  // Link document to event
  const handleLinkDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      showNotification('Please select an active event first.', 'error');
      return;
    }
    if (!linkingDocName.trim() || !linkingDocUrl.trim()) {
      showNotification('Please provide a document name and valid URL.', 'error');
      return;
    }

    try {
      const response = await apiFetch('/api/planning/attached-docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: linkingDocName.trim(),
          type: linkingDocUrl.toLowerCase().includes('sheet') ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.document',
          source: 'google',
          url: linkingDocUrl.trim(),
          embedUrl: linkingDocUrl.trim(),
          attachedBy: userName,
          eventId: selectedEventId,
          category: linkingDocCategory
        })
      });

      if (response.ok) {
        const newDoc = await response.json();
        // Event broadcast is handled by server API POST now.
              setAttachedDocs(prev => prev.some(d => d.id === newDoc.id) ? prev : [...prev, newDoc]);
        setLinkingDocName('');
        setLinkingDocUrl('');
        setIsLinkingDocOpen(false);
        showNotification('Document linked to event successfully!', 'success');
      } else {
        showNotification('Failed to link document.', 'error');
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  // Unlink document from event
  const handleUnlinkDoc = async (docId: string) => {
    try {
      const response = await apiFetch(`/api/planning/attached-docs/${docId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAttachedDocs(prev => prev.filter(d => d.id !== docId));
        showNotification('Document unlinked successfully.', 'success');
      } else {
        showNotification('Failed to unlink document.', 'error');
      }
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    }
  };

  // Create new file natively (Doc or Sheet)
  const handleCreateNewFile = async (fileType: 'doc' | 'sheet') => {
    if (!selectedEventId) {
      showNotification('Please select an active event first.', 'error');
      return;
    }

    const eventObj = events.find(e => e.id === selectedEventId);
    const eventName = eventObj ? eventObj.name : 'Event';
    const fileName = `${eventName} - ${fileType === 'doc' ? 'Planning Guide' : 'Budget & Prep Tracker'}`;
    const category = fileType === 'doc' ? 'Meeting Minutes' : 'Spreadsheets/Budgets';

    setCreatingFile(true);

    try {
      if (googleAccessToken) {
        const mimeType = fileType === 'doc' ? 'application/vnd.google-apps.document' : 'application/vnd.google-apps.spreadsheet';
        
        // Proxy the creation through the server to bypass readonly OAuth constraints and use server credentials
        const res = await apiFetch('/api/planning/attached-docs/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fileName,
            type: mimeType,
            eventId: selectedEventId,
            attachedBy: userName,
            category: category,
            content: '' // No content, just create the metadata and attach
          })
        });
        
        if (res.ok) {
          const newDoc = await res.json();
          setAttachedDocs(prev => prev.some(d => d.id === newDoc.id) ? prev : [...prev, newDoc]);
          showNotification(`Created and linked new Google ${fileType === 'doc' ? 'Document' : 'Spreadsheet'}!`, 'success');
          fetchDriveFilesFromBackend(activeFolderId || undefined);
        } else {
          const errorMsg = await res.text();
          throw new Error(errorMsg);
        }
      } else {
        const mimeType = fileType === 'doc' ? 'application/vnd.google-apps.document' : 'application/vnd.google-apps.spreadsheet';
        const docId = `sim_${Date.now()}`;
        const simulatedUrl = fileType === 'doc' 
          ? `https://docs.google.com/document/d/${docId}/edit` 
          : `https://docs.google.com/spreadsheets/d/${docId}/edit`;

        const dbRes = await apiFetch('/api/planning/attached-docs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fileName,
            type: mimeType,
            source: 'google',
            url: simulatedUrl,
            embedUrl: simulatedUrl,
            attachedBy: userName,
            eventId: selectedEventId,
            category: category
          })
        });

        if (dbRes.ok) {
          const newDoc = await dbRes.json();
          setAttachedDocs(prev => prev.some(d => d.id === newDoc.id) ? prev : [...prev, newDoc]);
          showNotification(`[Simulation Mode] Created new localized Google ${fileType === 'doc' ? 'Doc' : 'Sheet'} metadata. Connect a Google account to create live Drive assets.`, 'success');
        }
      }
    } catch (err: any) {
      console.error(err);
      showNotification(`Failed to create file: ${err.message}`, 'error');
    } finally {
      setCreatingFile(false);
    }
  };


  // Extract file ID from Google Drive URL
  const extractFileId = (url?: string): string | null => {
    if (!url) return null;
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
  };

  // Perform a permission audit on a document
  const handleAuditDocument = async (doc: AttachedDoc) => {
    const fileId = extractFileId(doc.url);
    
    // If not connected to Google Drive or file is a simulation file, open the interactive manual guide
    if (!googleAccessToken || (doc.id && doc.id.startsWith('sim_')) || !fileId) {
      setActiveAuditDoc(doc);
      setManualAuditVerified(doc.auditStatus === 'ok');
      setIsAuditModalOpen(true);
      return;
    }

    setAuditingDocId(doc.id);
    showNotification(`Auditing access permissions for "${doc.name}"...`, 'success');

    try {
      // Fetch permissions from the Google Drive API
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=permissions(id,type,role,allowFileDiscovery)`,
        {
          headers: {
            Authorization: `Bearer ${googleAccessToken}`
          }
        }
      );

      let auditStatus: 'ok' | 'warning' | 'restricted' = 'restricted';
      let auditDetails = '';
      let auditSharedWithLink = false;
      let auditAnyoneCanEdit = false;

      if (res.ok) {
        const data = await res.json();
        const permissions = data.permissions || [];
        
        // Find if anyone with the link can access (type === 'anyone')
        const anyonePermission = permissions.find((p: any) => p.type === 'anyone');
        
        if (anyonePermission) {
          auditSharedWithLink = true;
          if (anyonePermission.role === 'writer' || anyonePermission.role === 'organizer' || anyonePermission.role === 'fileOrganizer') {
            auditStatus = 'ok';
            auditAnyoneCanEdit = true;
            auditDetails = 'Anyone with the link can EDIT. Perfect setup for collaborative meeting planning!';
          } else {
            auditStatus = 'warning';
            auditDetails = 'Anyone with the link can VIEW but NOT edit. Change access level to Editor for meeting participation.';
          }
        } else {
          auditStatus = 'restricted';
          auditDetails = 'Access is RESTRICTED to specific users. This will block general team members from collaborating.';
        }
      } else {
        // If 403 or 404, it is highly likely that access is restricted to the owner
        if (res.status === 403 || res.status === 404) {
          auditStatus = 'restricted';
          auditDetails = 'Drive API returned restricted access (403/404). Only the owner has access to check permissions.';
        } else {
          const errText = await res.text();
          throw new Error(errText || 'Drive API access failed');
        }
      }

      // Save the audit results back to the database
      const patchRes = await apiFetch(`/api/planning/attached-docs/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditStatus,
          auditDetails,
          auditCheckedAt: new Date().toISOString(),
          auditSharedWithLink,
          auditAnyoneCanEdit
        })
      });

      if (patchRes.ok) {
        const updatedDoc = await patchRes.json();
        setAttachedDocs(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));
        showNotification(`Permission audit completed for "${doc.name}"! Status: ${auditStatus === 'ok' ? 'Public Editor' : auditStatus === 'warning' ? 'View Only' : 'Restricted'}`, 'success');
      } else {
        showNotification('Failed to update audit status on server.', 'error');
      }

    } catch (err: any) {
      console.error('Audit failed:', err);
      showNotification(`Audit query failed: ${err.message || err}`, 'error');
    } finally {
      setAuditingDocId(null);
    }
  };

  // Register push notifications watch via Google Drive Webhook subscription
  const handleWatchDocument = async (doc: AttachedDoc) => {
    setRegisteringWatchId(doc.id);
    showNotification(`Configuring real-time webhook push subscription for "${doc.name}"...`, 'success');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (googleAccessToken) {
        headers['Authorization'] = `Bearer ${googleAccessToken}`;
      }

      const res = await apiFetch(`/api/planning/attached-docs/${doc.id}/watch`, {
        method: 'POST',
        headers
      });

      if (res.ok) {
        const data = await res.json();
        if (data.simulated) {
          showNotification('Simulated real-time Webhook Watch registered successfully!', 'success');
        } else {
          showNotification('Real-time Google Drive Webhook subscription activated!', 'success');
        }
        await fetchPlanningData();
      } else {
        const err = await res.json();
        showNotification(`Watch subscription failed: ${err.error}`, 'error');
      }
    } catch (err: any) {
      console.error('Watch setup error:', err);
      showNotification(`Failed to configure webhook watch: ${err.message}`, 'error');
    } finally {
      setRegisteringWatchId(null);
    }
  };

  // Dispatch mock external Google Drive update event to trigger push webhook
  const handleTriggerWebhook = async (doc: AttachedDoc) => {
    if (!doc.watchResourceId) {
      showNotification('Webhook watcher is not configured on this asset.', 'error');
      return;
    }

    setTriggeringWebhookId(doc.id);
    showNotification(`Dispatching simulated Google Drive change event for "${doc.name}"...`, 'success');

    try {
      const res = await apiFetch('/api/drive/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: doc.watchChannelId,
          resourceId: doc.watchResourceId,
          resourceState: 'update'
        })
      });

      if (res.ok) {
        console.log('Simulated webhook event dispatched successfully.');
      } else {
        showNotification('Failed to trigger mock webhook event.', 'error');
      }
    } catch (err: any) {
      console.error('Trigger webhook error:', err);
      showNotification(`Simulation error: ${err.message}`, 'error');
    } finally {
      setTriggeringWebhookId(null);
    }
  };

  // Save manual verification from modal
  const handleSaveManualAudit = async () => {
    if (!activeAuditDoc) return;

    try {
      const auditStatus = manualAuditVerified ? 'ok' : 'restricted';
      const auditDetails = manualAuditVerified 
        ? 'Manually verified: Anyone with the link can edit.' 
        : 'Access is Restricted. Need to configure "Anyone with the link can edit" in Google Drive.';

      const patchRes = await apiFetch(`/api/planning/attached-docs/${activeAuditDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditStatus,
          auditDetails,
          auditCheckedAt: new Date().toISOString(),
          auditSharedWithLink: manualAuditVerified,
          auditAnyoneCanEdit: manualAuditVerified
        })
      });

      if (patchRes.ok) {
        const updatedDoc = await patchRes.json();
        setAttachedDocs(prev => prev.map(d => d.id === activeAuditDoc.id ? updatedDoc : d));
        setIsAuditModalOpen(false);
        setActiveAuditDoc(null);
        showNotification(`Permissions manually updated for "${activeAuditDoc.name}"!`, 'success');
      } else {
        showNotification('Failed to save manual audit status.', 'error');
      }
    } catch (err: any) {
      console.error('Manual save failed:', err);
      showNotification(`Failed to save manual check: ${err.message}`, 'error');
    }
  };


  const handleGoBack = () => {
    if (folderHistory.length > 0) {
      const newHistory = [...folderHistory];
      newHistory.pop();
      setFolderHistory(newHistory);
      const parentFolderId = newHistory.length > 0 ? newHistory[newHistory.length - 1].id : null;
      setActiveFolderId(parentFolderId);
      fetchDriveFilesFromBackend(parentFolderId || undefined);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Centralized Document Hub Workspace */}
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Local Tab Sub-Navigation Menu */}
        <div className="flex border border-[#e2dcd0] p-1 bg-[#faf8f4] rounded-2xl overflow-x-auto gap-1">
          <button
            onClick={() => setActiveTab('docs')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'docs'
                ? 'bg-white border border-[#e2dcd0] text-[#856637] shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
            }`}
          >
            <FolderOpen size={14} className="text-[#856637]" />
            Event Document Hub
          </button>
          <button
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 ${
              activeTab === 'drive'
                ? 'bg-white border border-[#e2dcd0] text-[#856637] shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
            }`}
          >
            <Globe size={14} className="text-slate-500" />
            Shared Team Directory
          </button>
        </div>

        {/* Tab 1: Event Document Hub */}
        {activeTab === 'docs' && (
          <div className="space-y-6">
            
            {/* Context / Selector Panel */}
            <div className="bg-[#faf8f4] border border-[#e2dcd0] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#856637]">Active Hub Focus</span>
                <h4 className="text-sm font-serif font-black text-slate-800">Event Context Selection</h4>
                <p className="text-[11px] text-slate-500">Select an event to view, create, or link its direct document checklist and templates.</p>
              </div>
              <div className="w-full sm:w-auto flex items-center gap-2">
                <select
                  value={selectedEventId}
                  onChange={(e) => { setSelectedEventId(e.target.value); const evt = events.find(ev => ev.id === e.target.value); setEventFolderInput(evt?.driveFolderId || ''); }}
                  className="w-full sm:w-64 px-3 py-2 border border-[#e2dcd0] rounded-xl bg-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#c2aa80] text-slate-700"
                >
                  <option value="" disabled>-- Select target event --</option>
                  {events.map(evt => (
                    <option key={evt.id} value={evt.id}>
                      {evt.name} ({new Date(evt.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })})
                    </option>
                  ))}
                </select>
                {selectedEventId && (
                  <button
                    onClick={() => { setCloneEventTargetId(selectedEventId); setCloneEventNewDate(''); }}
                    className="p-2 bg-[#fcfaf7] border border-[#e2dcd0] hover:border-[#c2aa80] text-slate-500 hover:text-[#856637] rounded-xl transition cursor-pointer flex-shrink-0"
                    title="Clone to New Year"
                  >
                    <Copy size={16} />
                  </button>
                )}
              </div>
            </div>

            {selectedEventId && (
              <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 -mt-2 mb-2">
                <div className="space-y-0.5 flex-1">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Globe size={12} className="text-[#856637]" /> Target Drive Folder</h4>
                  <p className="text-[10px] text-slate-500">Google Drive Folder ID where new docs for this event will be saved (overrides global folder).</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={eventFolderInput}
                    onChange={(e) => setEventFolderInput(e.target.value)}
                    placeholder="Folder ID or URL..."
                    className="flex-1 px-3 py-1.5 border border-[#e2dcd0] rounded-xl bg-white focus:outline-none focus:border-[#c2aa80] text-xs"
                  />
                  <button
                    onClick={async () => {
                      if (!onUpdateEvent) return;
                      
                      let cleanId = eventFolderInput;
                      if (cleanId.includes('/folders/')) {
                        cleanId = cleanId.split('/folders/')[1].split('?')[0].split('/')[0];
                      }
                      
                      setEventFolderInput(cleanId);
                      await onUpdateEvent(selectedEventId, { driveFolderId: cleanId });
                      showNotification('Event Drive folder updated successfully!', 'success');
                    }}
                    className="px-3 py-1.5 bg-[#856637] hover:bg-[#72572e] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {selectedEventId ? (
              (() => {
                const activeEvt = events.find(e => e.id === selectedEventId);
                const eventDocs = attachedDocs.filter(d => d.eventId === selectedEventId);

                // Categories split
                const categories = [
                  { name: 'Spreadsheets/Budgets', title: 'Spreadsheets', icon: <FileSpreadsheet className="text-emerald-600" size={16} /> },
                  { name: 'Meeting Minutes', title: 'Documents', icon: <FileText className="text-blue-500" size={16} /> }
                ];

                return (
                  <div className="space-y-6">
                    {/* Event banner context card */}
                    {activeEvt && (
                      <div className="bg-[#faf8f4]/60 border border-[#e2dcd0]/80 rounded-2xl p-5 space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                          <Calendar size={11} />
                          <span>{new Date(activeEvt.date).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <h3 className="text-lg font-serif font-black text-[#856637]">{activeEvt.name}</h3>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">{activeEvt.description}</p>
                      </div>
                    )}

                    {/* Responsive Drag and Drop File Portal Zone */}
                    <div 
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverPortal(true);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverPortal(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverPortal(false);
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverPortal(false);
                        const files = e.dataTransfer.files;
                        if (files && files.length > 0) {
                          await handleFilePortalUpload(files[0], selectedEventId);
                        }
                      }}
                      onClick={() => {
                        const input = document.getElementById(`planning-portal-file-input`);
                        if (input) input.click();
                      }}
                      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden ${
                        dragOverPortal 
                          ? 'border-[#856637] bg-[#f5ebd6]/50 scale-[1.01]' 
                          : 'border-[#e2dcd0] bg-white hover:border-[#c2aa80] hover:bg-[#faf8f4]/40'
                      }`}
                    >
                      {isUploading ? (
                        <div className="space-y-3 flex flex-col items-center">
                          <Loader2 className="w-8 h-8 text-[#856637] animate-spin" />
                          <p className="text-xs font-mono font-bold tracking-wide text-[#856637] uppercase">
                            Secure Uploading Portal
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {uploadProgress}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-[#f5ebd6] text-[#856637] flex items-center justify-center shadow-sm">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-serif font-black text-slate-800 mb-1">
                              Responsive Drag-and-Drop File Portal
                            </h4>
                            <p className="text-[11px] text-slate-500 max-w-md leading-relaxed mx-auto">
                              Drag and drop a local spreadsheet, text document, or presentation here to automatically upload to this event's Google Drive folder in the background. Sharing permissions will update to <strong className="font-bold text-[#856637]">"Anyone can edit"</strong> and register in the hub!
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fdfcfb] border border-[#e2dcd0] text-[10px] font-semibold text-slate-500 hover:text-slate-700 transition">
                            Or select file manually from computer
                          </span>
                        </>
                      )}
                      
                      <input 
                        id="planning-portal-file-input"
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            await handleFilePortalUpload(files[0], selectedEventId);
                          }
                        }}
                      />
                    </div>

                    {/* Permission Warning Banner */}
                    {eventDocs.some(d => d.auditStatus === 'restricted' || d.auditStatus === 'warning') && (
                      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start justify-between shadow-xs">
                        <div className="flex gap-2.5 items-start">
                          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600 shrink-0 mt-0.5">
                            <ShieldAlert size={16} className="animate-bounce" />
                          </div>
                          <div className="text-left">
                            <h4 className="text-xs font-bold text-rose-950 font-sans">Permission Action Required</h4>
                            <p className="text-[10px] text-rose-850 leading-relaxed mt-0.5">
                              Some linked assets for this event have restricted access. Before starting your meeting, please ensure permissions are correctly set to <strong className="font-bold">"Anyone with the link can edit"</strong> so all team members can contribute!
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const firstWarn = eventDocs.find(d => d.auditStatus === 'restricted' || d.auditStatus === 'warning');
                            if (firstWarn) handleAuditDocument(firstWarn);
                          }}
                          className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
                        >
                          Resolve Permissions
                        </button>
                      </div>
                    )}

                    {/* Categorized list display */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categories.map(cat => {
                        const docsInCat = eventDocs.filter(d => d.category === cat.name);

                        return (
                          <div key={cat.name} className="bg-white border border-[#e2dcd0] rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                                {cat.icon}
                                <h5 className="text-xs font-serif font-black text-slate-800">{cat.title}</h5>
                                <span className="ml-auto text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                                  {docsInCat.length}
                                </span>
                              </div>

                              <div className="space-y-2.5">
                                {docsInCat.length === 0 ? (
                                  <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl text-[11px]">
                                    No documents attached. Create or link one below.
                                  </div>
                                ) : (
                                  docsInCat.map(doc => (
                                    <div key={doc.id} className="flex flex-col gap-2 p-3 bg-[#faf8f4] border border-[#e2dcd0]/50 rounded-xl hover:bg-[#faf8f4]/90 transition text-left">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0 flex-1 flex items-center gap-2">
                                          <div className="shrink-0 p-1.5 rounded bg-white border border-slate-200 text-slate-500">
                                            {doc.type.includes('spreadsheet') ? <FileSpreadsheet size={13} className="text-emerald-600" /> : <FileText size={13} className="text-blue-500" />}
                                          </div>
                                          <div className="min-w-0 text-left">
                                            <span className="block font-sans font-semibold text-slate-800 text-xs truncate" title={doc.name}>
                                              {doc.name}
                                            </span>
                                            <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                                              By {doc.attachedBy} • {doc.date}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            onClick={() => handleAuditDocument(doc)}
                                            disabled={auditingDocId === doc.id}
                                            className={`p-1.5 rounded bg-white border border-slate-200 text-slate-450 hover:text-[#856637] hover:border-[#c2aa80] transition shadow-xs cursor-pointer ${
                                              doc.auditStatus === 'restricted' ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 
                                              doc.auditStatus === 'warning' ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : ''
                                            }`}
                                            title="Audit Sharing & Access Permissions"
                                          >
                                            {auditingDocId === doc.id ? <Loader2 size={11} className="animate-spin" /> : <Shield size={11} />}
                                          </button>
                                          <button
                                            onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                                            className="p-1.5 rounded bg-white border border-slate-200 text-slate-450 hover:text-[#856637] hover:border-[#c2aa80] transition shadow-xs cursor-pointer"
                                            title="Open in Google Workspace"
                                          >
                                            <ExternalLink size={11} />
                                          </button>
                                          <button
                                            onClick={() => handleUnlinkDoc(doc.id)}
                                            className="p-1.5 rounded bg-white border border-slate-200 text-slate-350 hover:text-red-500 hover:border-red-200 transition shadow-xs cursor-pointer"
                                            title="Unlink"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Document Permissions Audit Info row */}
                                      <div className="pt-2 border-t border-slate-200/50 flex flex-col gap-2">
                                        {/* Row 1: Access Status */}
                                        <div className="flex items-center justify-between text-[9px]">
                                          <span className="text-slate-400 font-mono">Sharing Audit:</span>
                                          <div className="flex items-center gap-1">
                                            {doc.auditStatus === 'ok' ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[9px] text-emerald-700 font-semibold" title={doc.auditDetails}>
                                                <ShieldCheck size={10} className="text-emerald-600" />
                                                Anyone can Edit
                                              </span>
                                            ) : doc.auditStatus === 'warning' ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[9px] text-amber-700 font-semibold" title={doc.auditDetails}>
                                                <ShieldAlert size={10} className="text-amber-600" />
                                                View Only (Viewer)
                                              </span>
                                            ) : doc.auditStatus === 'restricted' ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[9px] text-rose-700 font-semibold" title={doc.auditDetails}>
                                                <Lock size={10} className="text-rose-600" />
                                                Restricted Access
                                              </span>
                                            ) : auditingDocId === doc.id ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[9px] text-slate-500">
                                                <Loader2 size={10} className="animate-spin" />
                                                Auditing...
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] text-slate-400 font-medium">
                                                <Shield size={10} className="text-slate-400" />
                                                Unchecked
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Row 2: Intelligent Google Drive Push Notification Webhooks */}
                                        <div className="flex items-center justify-between text-[9px] bg-slate-100/50 p-1.5 rounded-lg border border-slate-200/40">
                                          <span className="text-slate-500 font-sans font-medium flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${doc.watchStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                                            Real-time Watcher:
                                          </span>
                                          <div className="flex items-center gap-1.5">
                                            {doc.watchStatus === 'active' ? (
                                              <>
                                                <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1 rounded-sm">Active</span>
                                                <button
                                                  type="button"
                                                  onClick={(e) => { e.stopPropagation(); handleTriggerWebhook(doc); }}
                                                  disabled={triggeringWebhookId === doc.id}
                                                  className="text-[9px] text-[#856637] hover:text-[#5c4422] font-bold underline disabled:opacity-50 cursor-pointer"
                                                  title="Trigger simulated Drive update events in the background"
                                                >
                                                  {triggeringWebhookId === doc.id ? 'Simulating...' : 'Simulate Change'}
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleWatchDocument(doc); }}
                                                disabled={registeringWatchId === doc.id}
                                                className="text-[9px] bg-[#856637] hover:bg-[#6c512a] text-white px-2 py-0.5 rounded-md font-bold transition flex items-center gap-1 shrink-0 cursor-pointer font-sans"
                                              >
                                                {registeringWatchId === doc.id ? <Loader2 size={8} className="animate-spin" /> : null}
                                                Enable Watcher
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        {doc.auditDetails && (
                                          <p className="text-[9px] text-slate-500 leading-normal italic bg-white/45 p-1.5 rounded border border-slate-100 mt-0.5">
                                            {doc.auditDetails}
                                          </p>
                                        )}

                                        {/* Collapsible Audit History Section */}
                                        <div className="mt-1 border-t border-slate-200/40 pt-1.5">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setExpandedHistoryDocId(expandedHistoryDocId === doc.id ? null : doc.id);
                                            }}
                                            className="w-full flex items-center justify-between text-[9px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                                          >
                                            <span className="flex items-center gap-1 font-sans">
                                              <Clock size={10} />
                                              Audit History Log ({doc.auditHistory ? doc.auditHistory.length : 0})
                                            </span>
                                            <span>{expandedHistoryDocId === doc.id ? 'Hide ▴' : 'Show ▾'}</span>
                                          </button>

                                          {expandedHistoryDocId === doc.id && (
                                            <div className="mt-1.5 space-y-1.5 max-h-32 overflow-y-auto pr-1 bg-white p-2 rounded-lg border border-slate-150 text-left">
                                              {!doc.auditHistory || doc.auditHistory.length === 0 ? (
                                                <p className="text-[8px] text-slate-400 italic text-center py-1">No historical checks found. Trigger an audit above or via watcher to log status.</p>
                                              ) : (
                                                doc.auditHistory.map((hist: any) => (
                                                  <div key={hist.id} className="text-[8px] border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                                                    <div className="flex items-center justify-between font-mono text-[7.5px] text-slate-400">
                                                      <span>{new Date(hist.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {hist.triggerType === 'webhook' ? 'Webhook ⚡' : 'Manual 👤'}</span>
                                                      <span className={`font-semibold px-1 rounded-sm ${
                                                        hist.status === 'ok' ? 'bg-emerald-50 text-emerald-700' :
                                                        hist.status === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                                                      }`}>
                                                        {hist.status.toUpperCase()}
                                                      </span>
                                                    </div>
                                                    <p className="text-slate-600 mt-0.5 leading-relaxed font-sans font-medium">
                                                      Checked by <span className="font-bold text-slate-800">{hist.checkedBy}</span>: {hist.details || 'No additional remarks.'}
                                                    </p>
                                                  </div>
                                                ))
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Creation & Linking Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                      
                      {/* Document template instantiation */}
                      <div className="bg-[#faf8f4]/45 border border-[#e2dcd0]/70 rounded-2xl p-5 space-y-4">
                        <div className="space-y-1 text-left">
                          <h5 className="text-xs font-bold text-[#856637] flex items-center gap-1">
                            <Sparkles size={13} />
                            Instantiate Standard Templates
                          </h5>
                          <p className="text-[10px] text-slate-400">
                            Natively generate official planning files directly within Google Drive mapped to this event scope.
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <button
                            onClick={() => handleCreateNewFile('doc')}
                            disabled={creatingFile}
                            className="flex-1 bg-[#1e293b] text-white hover:bg-slate-900 font-bold px-3 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-sm"
                          >
                            {creatingFile ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            Create New Doc
                          </button>
                          <button
                            onClick={() => handleCreateNewFile('sheet')}
                            disabled={creatingFile}
                            className="flex-1 bg-[#1e293b] text-white hover:bg-slate-900 font-bold px-3 py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-sm"
                          >
                            {creatingFile ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            Create New Sheet
                          </button>
                        </div>
                      </div>

                      {/* Manual attachment mapping form */}
                      <div className="bg-[#faf8f4]/45 border border-[#e2dcd0]/70 rounded-2xl p-5 space-y-4">
                        <div className="flex justify-between items-center text-left">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-bold text-[#856637]">Link Existing Asset</h5>
                            <p className="text-[10px] text-slate-400">Map an existing Google sheet or guide into this checklist.</p>
                          </div>
                          <button
                            onClick={() => setIsLinkingDocOpen(!isLinkingDocOpen)}
                            className="text-[10px] text-[#856637] hover:underline font-bold transition"
                          >
                            {isLinkingDocOpen ? 'Collapse' : 'Expand Form'}
                          </button>
                        </div>

                        {isLinkingDocOpen && (
                          <form onSubmit={handleLinkDoc} className="space-y-3 text-left">
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Asset Name</label>
                              <input
                                type="text"
                                value={linkingDocName}
                                onChange={(e) => setLinkingDocName(e.target.value)}
                                placeholder="e.g. Master Logistics Agenda Spreadsheet"
                                className="w-full px-2.5 py-1.5 border border-[#e2dcd0] rounded-lg bg-white text-xs focus:outline-none focus:border-[#c2aa80]"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Template Category</label>
                                <select
                                  value={linkingDocCategory}
                                  onChange={(e) => setLinkingDocCategory(e.target.value as any)}
                                  className="w-full px-2 py-1.5 border border-[#e2dcd0] rounded-lg bg-white text-xs focus:outline-none text-slate-700"
                                >
                                  <option value="Spreadsheets/Budgets">Spreadsheets</option>
                                  <option value="Meeting Minutes">Documents</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Workspace User</label>
                                <input
                                  type="text"
                                  disabled
                                  value={userName}
                                  className="w-full px-2 py-1.5 border border-[#e2dcd0] rounded-lg bg-slate-50 text-xs text-slate-450"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Workspace Document URL</label>
                              <input
                                type="url"
                                value={linkingDocUrl}
                                onChange={(e) => setLinkingDocUrl(e.target.value)}
                                placeholder="https://docs.google.com/document/d/..."
                                className="w-full px-2.5 py-1.5 border border-[#e2dcd0] rounded-lg bg-white text-xs focus:outline-none focus:border-[#c2aa80]"
                              />
                            </div>
                            <button
                              type="submit"
                              className="w-full bg-[#1e293b] hover:bg-slate-900 text-white font-bold py-2 rounded-lg text-xs transition cursor-pointer shadow-sm"
                            >
                              Attach Link to Event
                            </button>
                          </form>
                        )}
                      </div>

                    </div>

                    {/* Shared drives permissions recommendation */}
                    <div className="bg-[#fcfaf7] border border-[#e2dcd0] rounded-2xl p-5 text-left space-y-2">
                      <h6 className="text-[11px] font-serif font-bold text-slate-800 flex items-center gap-1.5">
                        <Settings size={12} className="text-[#856637]" />
                        Operational Permission Recommendations & Shared Drives
                      </h6>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        To guarantee that all Ministry Leads can edit newly instantiated files natively, configure a dedicated **Google Shared Team Drive**. Creating docs inside a Shared Drive ensures permissions inherit automatically so anyone with a MinistryOS login maintains co-authoring rights without individual invitation friction.
                      </p>
                    </div>

                  </div>
                );
              })()
            ) : (
              <div className="text-center py-16 bg-white border border-[#e2dcd0] rounded-2xl text-slate-400 text-xs italic">
                Select an Event Context from the menu above to browse event documents.
              </div>
            )}

          </div>
        )}

        {/* Tab 2: Shared Team Directory (Google Drive Folder) */}
        {activeTab === 'drive' && (
          <div className="bg-white rounded-2xl border border-[#e2dcd0] shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 flex flex-col min-h-[580px] overflow-hidden">
            
            {/* Hub Header */}
            <div className="border-b border-[#e2dcd0] bg-[#faf8f4] p-4 flex items-center justify-between gap-4">
              <div className="min-w-0 text-left">
                <h4 className="text-sm font-serif font-bold text-slate-800 flex items-center gap-2">
                  <FolderOpen size={16} className="text-[#856637]" />
                  Centralized Document Hub
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                  Target: <span className="font-semibold text-slate-600 font-mono">{savedFolderDetails?.name || currentFolderName}</span>
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Connection Status Badge */}
                <div className="flex items-center gap-1.5 shrink-0 mr-1">
                  {(!driveStatus || (!driveStatus.connected)) ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span className="hidden sm:inline">Drive not connected</span>
                      </span>
                      <button
                        onClick={handleConnectDrive}
                        className="shrink-0 bg-[#856637] hover:bg-[#72572e] text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <LogIn size={11} /> Connect Drive
                      </button>
                    </div>
                  ) : driveStatus.connected && driveStatus.expired ? (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-850 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      <span>Needs reconnect</span>
                      <button
                        onClick={handleConnectDrive}
                        className="text-[#856637] hover:text-[#72572e] font-bold underline cursor-pointer shrink-0"
                      >
                        Reconnect
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="truncate max-w-[130px] sm:max-w-[200px]" title={`Drive connected${driveStatus.folderName ? ` (${driveStatus.folderName})` : ''}`}>
                        Drive connected{driveStatus.folderName ? ` (${driveStatus.folderName})` : ''}
                      </span>
                      <button
                        onClick={handleDisconnectDrive}
                        className="text-emerald-600 hover:text-emerald-800 font-bold underline cursor-pointer shrink-0"
                      >
                        Disconnect
                      </button>
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setIsEditingFolder(!isEditingFolder)}
                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                    isEditingFolder 
                      ? 'bg-[#f5ebd6] border-[#efe0c2] text-[#856637]' 
                      : 'bg-white border-[#e2dcd0] text-slate-500 hover:text-slate-800'
                  }`}
                  title="Configure Target Folder ID"
                >
                  <Settings size={14} />
                </button>
                
                <button
                  onClick={() => fetchDriveFilesFromBackend(activeFolderId || undefined)}
                  disabled={loadingDrive}
                  className="p-1.5 bg-white border border-[#e2dcd0] hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-lg transition cursor-pointer disabled:opacity-50 shrink-0"
                  title="Reload Files"
                >
                  <RefreshCw size={14} className={loadingDrive ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Folder Configuration Form */}
            {isEditingFolder && (
              <div className="bg-amber-50/40 border-b border-[#e2dcd0] p-4 space-y-3 text-left">
                <div className="space-y-1">
                  <h5 className="text-[11px] font-bold text-[#856637]">Configure Google Drive Target Folder</h5>
                  <p className="text-[10px] text-slate-400">
                    Paste the shared Google Drive folder URL or Folder ID. This updates the hub instantly for all Ministry Leads.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={configFolderId}
                    onChange={(e) => setConfigFolderId(e.target.value)}
                    placeholder="e.g. https://drive.google.com/drive/folders/1A2B3C..."
                    className="flex-1 px-3 py-1.5 border border-[#e2dcd0] rounded-xl bg-white focus:outline-none focus:border-[#c2aa80] text-xs"
                  />
                  <button
                    onClick={() => handleSaveFolderSettings(configFolderId)}
                    className="bg-[#1e293b] text-white hover:bg-slate-900 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingFolder(false)}
                    className="bg-white border border-[#e2dcd0] text-slate-600 hover:bg-slate-50 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Hub Body */}
            <div className="p-4 flex-1 flex flex-col space-y-4">
              
              {/* If there is an error configuration */}
              {errorDrive && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center space-y-2">
                  <p className="text-xs font-medium text-rose-800">
                    {errorDrive}
                  </p>
                  <div className="text-[10px] text-rose-600 max-w-sm mx-auto leading-relaxed">
                    Make sure the shared Google Drive folder link is correct, or share the folder with your service account email to grant access. Alternatively, authorize below.
                  </div>
                  {!firebaseUser && (
                    <button
                      onClick={handleGoogleLogin}
                      className="mx-auto flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition cursor-pointer"
                    >
                      <LogIn size={12} className="text-slate-500" />
                      Authorize with Google
                    </button>
                  )}
                </div>
              )}

              {/* If no auth configured & no files loaded (e.g. first run, no service account) */}
              {!errorDrive && !firebaseUser && driveFiles.length === 0 && !loadingDrive && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-[#f5ebd6]/60 border border-[#efe0c2] flex items-center justify-center text-[#856637]">
                    <Globe size={24} />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h5 className="text-xs font-bold text-slate-700">Connect Google Workspace Hub</h5>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      This centralized directory lists folders, documents, and spreadsheets from the designated folder. Sign in with Google to read and browse files dynamically inside this workspace.
                    </p>
                  </div>
                  <button
                    onClick={handleGoogleLogin}
                    className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.5 24c0-1.63-.15-3.2-.43-4.72H24v8.94h12.63c-.55 2.92-2.2 5.39-4.68 7.05v5.86h7.59c4.44-4.08 7-10.09 7-17.13z"/>
                      <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.59-5.86c-2.1.14-4.78 1.17-8.3 1.17-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Sign In with Google
                  </button>
                </div>
              )}

              {/* Browse Files Area (If files are loaded or we are loading) */}
              {((driveFiles && driveFiles.length > 0) || loadingDrive) && (
                <div className="flex-1 flex flex-col space-y-3 min-h-0">
                  
                  {isSimulation && (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                      <div className="flex gap-2.5 items-start">
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 shrink-0 mt-0.5">
                          <Globe size={15} />
                        </div>
                        <div className="space-y-0.5">
                          <h5 className="text-xs font-bold text-amber-950 font-sans">Simulation Workspace Active</h5>
                          <p className="text-[10px] text-amber-850 leading-relaxed">
                            No Google Authentication detected or Google Drive API is unconfigured. Showing high-fidelity interactive placeholder assets to plan event templates offline.
                          </p>
                        </div>
                      </div>
                      {!googleAccessToken && (
                        <button
                          onClick={handleConnectDrive}
                          className="shrink-0 bg-[#856637] hover:bg-[#72572e] text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <LogIn size={11} /> Connect Drive
                        </button>
                      )}
                    </div>
                  )}

                  {/* Filter Toolbar */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search current folder..."
                        value={driveSearch}
                        onChange={(e) => setDriveSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 border border-[#e2dcd0] rounded-xl bg-white focus:outline-none focus:border-[#c2aa80] text-xs text-left"
                      />
                    </div>

                    {/* View mode toggle */}
                    <div className="flex border border-[#e2dcd0] rounded-xl overflow-hidden bg-white shrink-0">
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 transition cursor-pointer ${viewMode === 'list' ? 'bg-[#f5ebd6] text-[#856637]' : 'text-slate-400 hover:text-slate-600'}`}
                        title="List View"
                      >
                        <ListIcon size={14} />
                      </button>
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 transition cursor-pointer ${viewMode === 'grid' ? 'bg-[#f5ebd6] text-[#856637]' : 'text-slate-400 hover:text-slate-600'}`}
                        title="Grid View"
                      >
                        <Grid size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Breadcrumb Navigation Trail */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-white border border-[#e2dcd0] rounded-xl px-3 py-2 font-medium text-slate-500 font-sans">

                    <button
                      onClick={handleGoBack}
                      disabled={folderHistory.length === 0}
                      className={`p-1 rounded flex items-center justify-center transition ${folderHistory.length === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer'}`}
                      title="Go back to parent folder"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <div className="w-px h-3 bg-slate-200 mx-1"></div>

                    <button 
                      onClick={() => {
                        setFolderHistory([]);
                        setActiveFolderId(null);
                        fetchDriveFilesFromBackend();
                      }}
                      className="hover:text-[#856637] transition font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Folder size={11} className="text-[#856637]" />
                      Root Hub
                    </button>
                    {folderHistory.map((folder, idx) => (
                      <React.Fragment key={folder.id}>
                        <ChevronRight size={10} className="text-slate-400 shrink-0" />
                        <button 
                          onClick={() => {
                            const newHistory = folderHistory.slice(0, idx + 1);
                            setFolderHistory(newHistory);
                            setActiveFolderId(folder.id);
                            fetchDriveFilesFromBackend(folder.id);
                          }}
                          className={`hover:text-[#856637] transition cursor-pointer ${
                            idx === folderHistory.length - 1 ? 'text-[#856637] font-bold' : ''
                          }`}
                        >
                          {folder.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* File List / Grid Stage */}
                  <div className="flex-1 overflow-y-auto min-h-[340px] pr-1">
                    {loadingDrive ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
                        <Loader2 size={24} className="animate-spin text-[#856637]" />
                        <p className="text-xs text-slate-400 font-medium">Scanning target directory...</p>
                      </div>
                    ) : (
                      (() => {
                        const filtered = driveFiles.filter(file => 
                          file.name.toLowerCase().includes(driveSearch.toLowerCase())
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-16 bg-white border border-dashed border-[#e2dcd0] rounded-xl text-slate-400 text-xs">
                              No files or folders found in this folder.
                            </div>
                          );
                        }

                        if (viewMode === 'grid') {
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                              {filtered.map((file) => {
                                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                                const isDoc = file.mimeType.includes('document');
                                const isSheet = file.mimeType.includes('spreadsheet');
                                const isSlide = file.mimeType.includes('presentation');
                                const isPdf = file.mimeType.includes('pdf');

                                let itemColor = 'text-slate-400 bg-slate-50';
                                let IconCmp = FileText;

                                if (isFolder) {
                                  itemColor = 'text-amber-500 bg-amber-50/60';
                                  IconCmp = Folder;
                                } else if (isDoc) {
                                  itemColor = 'text-blue-500 bg-blue-50/60';
                                  IconCmp = FileText;
                                } else if (isSheet) {
                                  itemColor = 'text-emerald-600 bg-emerald-50/60';
                                  IconCmp = FileSpreadsheet;
                                } else if (isSlide) {
                                  itemColor = 'text-amber-600 bg-amber-50/60';
                                  IconCmp = FileText;
                                } else if (isPdf) {
                                  itemColor = 'text-rose-500 bg-rose-50/60';
                                  IconCmp = FileText;
                                }

                                return (
                                  <div
                                    key={file.id}
                                    onClick={() => {
                                      if (isFolder) {
                                        setFolderHistory(prev => [...prev, { id: file.id, name: file.name }]);
                                        setActiveFolderId(file.id);
                                        fetchDriveFilesFromBackend(file.id);
                                      } else {
                                        window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
                                      }
                                    }}
                                    className="bg-[#faf8f4] hover:bg-white border border-[#e2dcd0] hover:border-[#c2aa80] rounded-2xl p-4 flex flex-col justify-between hover:shadow-lg transition-all duration-300 cursor-pointer h-40 text-left group relative overflow-hidden"
                                  >
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#f5ebd6]/10 to-transparent rounded-full -mr-4 -mt-4 group-hover:scale-150 transition-transform duration-500" />
                                    
                                    <div className="flex justify-between items-start relative z-10">
                                      <div className={`p-2.5 rounded-xl ${itemColor} shrink-0 shadow-xs flex items-center justify-center min-w-[36px] min-h-[36px]`}>
                                        {file.iconLink ? (
                                          <img
                                            src={file.iconLink}
                                            alt=""
                                            referrerPolicy="no-referrer"
                                            className="w-5 h-5 object-contain"
                                            onError={(e) => {
                                              (e.target as HTMLElement).style.display = 'none';
                                            }}
                                          />
                                        ) : (
                                          <IconCmp size={20} />
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                                          {isFolder ? 'Folder' : isDoc ? 'Doc' : isSheet ? 'Sheet' : isSlide ? 'Slide' : isPdf ? 'PDF' : 'File'}
                                        </span>
                                        {!isFolder && (
                                          <div className="p-1 rounded bg-white border border-slate-100 shadow-xs text-slate-300 group-hover:text-[#856637] group-hover:border-[#c2aa80] transition duration-300">
                                            <ExternalLink size={10} />
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="min-w-0 mt-3 relative z-10 flex-1 flex flex-col justify-end">
                                      <span className="block text-xs font-serif font-bold text-slate-800 group-hover:text-[#856637] transition duration-200 truncate font-sans mb-1" title={file.name}>
                                        {file.name}
                                      </span>
                                      
                                      <div className="flex items-center gap-1.5 text-[9px] text-slate-450 font-medium">
                                        <Clock size={9} className="text-slate-400 shrink-0" />
                                        <span className="truncate">
                                          {isFolder 
                                            ? 'Browse Directory' 
                                            : file.modifiedTime 
                                              ? `Modified ${new Date(file.modifiedTime).toLocaleDateString([], {month: 'short', day: 'numeric', year: 'numeric'})}`
                                              : 'Google Drive Asset'
                                          }
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="h-1 w-full bg-transparent absolute bottom-0 left-0 right-0 group-hover:bg-[#c2aa80] transition-colors duration-300" />
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }

                        {/* List View */}
                        return (
                          <div className="bg-white border border-[#e2dcd0] rounded-2xl overflow-hidden divide-y divide-[#e2dcd0]/50">
                            {filtered.map((file) => {
                              const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                              const isDoc = file.mimeType.includes('document');
                              const isSheet = file.mimeType.includes('spreadsheet');
                              const isSlide = file.mimeType.includes('presentation');
                              const isPdf = file.mimeType.includes('pdf');

                              let itemColor = 'text-slate-400';
                              let IconCmp = FileText;

                              if (isFolder) {
                                itemColor = 'text-amber-500';
                                IconCmp = Folder;
                              } else if (isDoc) {
                                itemColor = 'text-blue-500';
                                IconCmp = FileText;
                              } else if (isSheet) {
                                itemColor = 'text-emerald-600';
                                IconCmp = FileSpreadsheet;
                              } else if (isSlide) {
                                itemColor = 'text-amber-500';
                                IconCmp = FileText;
                              } else if (isPdf) {
                                itemColor = 'text-rose-500';
                                IconCmp = FileText;
                              }

                              return (
                                <div
                                  key={file.id}
                                  onClick={() => {
                                    if (isFolder) {
                                      setFolderHistory(prev => [...prev, { id: file.id, name: file.name }]);
                                      setActiveFolderId(file.id);
                                      fetchDriveFilesFromBackend(file.id);
                                    } else {
                                      window.open(file.webViewLink, '_blank', 'noopener,noreferrer');
                                    }
                                  }}
                                  className="p-3 hover:bg-[#faf8f4]/60 flex items-center justify-between gap-3 transition cursor-pointer text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`${itemColor} shrink-0`}>
                                      <IconCmp size={16} />
                                    </div>
                                    <div className="min-w-0 text-left">
                                      <span className="font-bold text-slate-700 truncate block font-sans" title={file.name}>
                                        {file.name}
                                      </span>
                                      <span className="text-[9px] text-slate-400 block font-mono mt-0.5">
                                        {isFolder ? 'Folder' : `Modified ${file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'N/A'}`}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {!isFolder ? (
                                      <a
                                        href={file.webViewLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                                      >
                                        <ExternalLink size={10} />
                                        Open Workspace
                                      </a>
                                    ) : (
                                      <span className="text-[10px] text-slate-300 font-medium px-2 py-1">
                                        View Folder
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>

                </div>
              )}

            </div>
          </div>
        )}



      </div>

      {/* Google Workspace Sharing Auditor Modal */}
      <AnimatePresence>
        {isAuditModalOpen && activeAuditDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              ref={sharingAuditorModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="sharing-auditor-title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#e2dcd0] rounded-2xl shadow-xl max-w-md w-full overflow-hidden text-left"
            >
              <div className="p-5 border-b border-[#e2dcd0]/50 flex justify-between items-center bg-[#faf8f4]">
                <div className="flex items-center gap-2">
                  <Shield className="text-[#856637]" size={18} aria-hidden="true" />
                  <h3 id="sharing-auditor-title" className="font-serif font-black text-slate-800 text-sm">Google Sharing Auditor</h3>
                </div>
                <button
                  onClick={() => {
                    setIsAuditModalOpen(false);
                    setActiveAuditDoc(null);
                  }}
                  aria-label="Close sharing auditor modal"
                  className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-[#faf8f4] border border-[#e2dcd0]/50 rounded-xl p-3.5 space-y-1">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 font-mono">Target Asset</span>
                  <div className="flex items-center gap-2">
                    {activeAuditDoc.type.includes('spreadsheet') ? (
                      <FileSpreadsheet size={14} className="text-emerald-600" />
                    ) : (
                      <FileText size={14} className="text-blue-500" />
                    )}
                    <h4 className="text-xs font-bold text-slate-800 font-sans truncate">{activeAuditDoc.name}</h4>
                  </div>
                  <a
                    href={activeAuditDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-[#856637] font-semibold underline mt-1 hover:text-[#c2aa80]"
                  >
                    Open Live File <ExternalLink size={9} />
                  </a>
                </div>

                <div className="space-y-2 text-left">
                  <h5 className="text-[10px] font-bold text-slate-700 uppercase tracking-wider font-mono">Manual sharing checklist</h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    If you are operating in simulation mode or lack an authorized owner token to perform automated checking, please perform this brief checklist in Google Drive manually:
                  </p>
                  
                  <ul className="space-y-1.5 text-[10px] text-slate-600 pl-1">
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-[#856637] shrink-0 font-bold">1.</span>
                      <span>Click the blue <strong className="font-semibold text-slate-800">"Share"</strong> button in the top-right corner of Google Workspace.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-[#856637] shrink-0 font-bold">2.</span>
                      <span>Under General Access, change status from "Restricted" to <strong className="font-semibold text-slate-800">"Anyone with the link"</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono text-[#856637] shrink-0 font-bold">3.</span>
                      <span>Update the access permission role from "Viewer" to <strong className="font-semibold text-slate-800">"Editor"</strong> (so team members can write during meetings).</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5">
                  <input
                    id="verify-check"
                    type="checkbox"
                    checked={manualAuditVerified}
                    onChange={(e) => setManualAuditVerified(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#856637] focus:ring-[#c2aa80] h-3.5 w-3.5 cursor-pointer"
                  />
                  <label htmlFor="verify-check" className="text-[10px] font-sans text-slate-600 leading-normal select-none cursor-pointer">
                    <strong className="font-semibold text-slate-800">Verified:</strong> I have updated the settings in Google Drive and verified that "Anyone with the link can edit" is successfully activated.
                  </label>
                </div>
              </div>

              <div className="p-4 border-t border-slate-150 bg-slate-50 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsAuditModalOpen(false);
                    setActiveAuditDoc(null);
                  }}
                  className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:text-slate-700 bg-white rounded-lg text-[10px] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveManualAudit}
                  className="px-3.5 py-1.5 bg-[#856637] hover:bg-[#72572e] text-white rounded-lg text-[10px] font-bold shadow-xs transition cursor-pointer"
                >
                  Save Sharing Audit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clone Event Modal */}
      <AnimatePresence>
        {cloneEventTargetId && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              ref={cloneEventModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="clone-event-title"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden"
            >
              <div className="bg-[#faf8f4] border-b border-[#efe0c2] px-5 py-4 flex justify-between items-center">
                <div>
                  <h3 id="clone-event-title" className="font-serif font-bold text-slate-800 text-lg">Clone Event to New Year</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 font-bold">Rollover Setup</p>
                </div>
                <button 
                  onClick={() => { setCloneEventTargetId(null); setCloneEventNewDate(''); }}
                  aria-label="Close clone event modal"
                  className="text-slate-400 hover:text-slate-600 p-1 transition cursor-pointer"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">New Event Date *</label>
                  <input
                    type="date"
                    required
                    value={cloneEventNewDate}
                    onChange={(e) => setCloneEventNewDate(e.target.value)}
                    className="w-full p-2 border border-[#e2dcd0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#856637] bg-white text-sm"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    This will create a fresh copy of the event on this new date. Tasks and asset reservations will be copied but reset to pending/incomplete states.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => { setCloneEventTargetId(null); setCloneEventNewDate(''); }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!cloneEventNewDate || !onCloneEvent) return;
                      setIsCloning(true);
                      await onCloneEvent(cloneEventTargetId, cloneEventNewDate);
                      setIsCloning(false);
                      setCloneEventTargetId(null);
                      setCloneEventNewDate('');
                    }}
                    disabled={!cloneEventNewDate || isCloning}
                    className="px-4 py-2 bg-[#856637] hover:bg-[#6c532b] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition cursor-pointer flex items-center gap-1.5"
                  >
                    {isCloning ? <Loader2 className="animate-spin" size={14} /> : <Copy size={14} />}
                    {isCloning ? 'Cloning...' : 'Confirm Clone'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={confirmState?.isOpen || false}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        onConfirm={() => confirmState?.resolve(true)}
        onCancel={() => confirmState?.resolve(false)}
      />
    </div>
  );
}

export default React.memo(PlanningCentre);
