import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, type User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { apiFetch } from './api';
import { useNotification } from '../context/NotificationContext';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');

export function useDriveIntegration(setUserName: Dispatch<SetStateAction<string>>) {
  const { showNotification } = useNotification();

  // Google Drive Integration states
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<{ connected: boolean; expired: boolean; folderName: string | null } | null>(null);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingDrive, setLoadingDrive] = useState<boolean>(false);

  // New Centralized Document Hub states
  const [errorDrive, setErrorDrive] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [currentFolderName, setCurrentFolderName] = useState<string>('Community Relations');
  const [folderHistory, setFolderHistory] = useState<Array<{ id: string; name: string }>>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [configFolderId, setConfigFolderId] = useState<string>('');
  const [savedFolderDetails, setSavedFolderDetails] = useState<{ id: string; name: string } | null>(null);
  const [isEditingFolder, setIsEditingFolder] = useState<boolean>(false);
  const [isSimulation, setIsSimulation] = useState<boolean>(false);

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
      
      const query = subfolderId ? `?subfolderId=${subfolderId}` : '';
      const response = await apiFetch(`/api/planning/drive-files${query}`);
      
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
      
      const res = await apiFetch('/api/planning/drive-folder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
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

  useEffect(() => {
    fetchFolderSettings();
    fetchDriveStatus();
  }, []);

  useEffect(() => {
    fetchDriveFilesFromBackend(activeFolderId || undefined);
    fetchDriveStatus();
  }, [googleAccessToken]);

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

  return {
    firebaseUser, setFirebaseUser,
    googleAccessToken, setGoogleAccessToken,
    driveStatus, setDriveStatus,
    driveFiles, setDriveFiles,
    loadingDrive, setLoadingDrive,
    errorDrive, setErrorDrive,
    activeFolderId, setActiveFolderId,
    currentFolderName, setCurrentFolderName,
    folderHistory, setFolderHistory,
    viewMode, setViewMode,
    configFolderId, setConfigFolderId,
    savedFolderDetails, setSavedFolderDetails,
    isEditingFolder, setIsEditingFolder,
    isSimulation, setIsSimulation,
    fetchDriveStatus, fetchFolderSettings, fetchDriveFilesFromBackend,
    handleSaveFolderSettings, handleConnectDrive, handleDisconnectDrive, handleGoBack,
  };
}
