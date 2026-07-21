import { useState, type Dispatch, type SetStateAction } from 'react';
import type { AttachedDoc } from '../types';
import { apiFetch } from './api';
import { useNotification } from '../context/NotificationContext';

export function useDocAudit(
  googleAccessToken: string | null,
  setAttachedDocs: Dispatch<SetStateAction<AttachedDoc[]>>,
  fetchPlanningData: () => Promise<void>,
) {
  const { showNotification } = useNotification();

  // Permission Audit states
  const [auditingDocId, setAuditingDocId] = useState<string | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [activeAuditDoc, setActiveAuditDoc] = useState<AttachedDoc | null>(null);
  const [manualAuditVerified, setManualAuditVerified] = useState<boolean>(false);
  const [expandedHistoryDocId, setExpandedHistoryDocId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [registeringWatchId, setRegisteringWatchId] = useState<string | null>(null);

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
      // Fetch permissions from the server-side Google Drive API proxy
      const res = await apiFetch(`/api/drive/audit/${fileId}`);

      let auditStatus: 'ok' | 'warning' | 'restricted' = 'restricted';
      let auditDetails = '';
      let auditSharedWithLink = false;
      let auditAnyoneCanEdit = false;

      if (res.ok) {
        const data = await res.json();
        const permissions = data.permissions || [];
        
        if (data.restricted || permissions.length === 0) {
          auditStatus = 'restricted';
          auditDetails = data.restricted 
            ? 'Drive API returned restricted access (403/404). Only the owner has access to check permissions.'
            : 'No permissions found. This file appears to be restricted or private.';
        } else {
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
        }
      } else {
        if (res.status === 401) {
          throw new Error('Authentication expired or missing on the server. Please reconnect Google Drive.');
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Server permission audit query failed');
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
      const res = await apiFetch(`/api/planning/attached-docs/${doc.id}/watch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
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

  return {
    auditingDocId, setAuditingDocId,
    isAuditModalOpen, setIsAuditModalOpen,
    activeAuditDoc, setActiveAuditDoc,
    manualAuditVerified, setManualAuditVerified,
    expandedHistoryDocId, setExpandedHistoryDocId,
    expandedCardId, setExpandedCardId,
    registeringWatchId, setRegisteringWatchId,
    handleAuditDocument, handleWatchDocument, handleSaveManualAudit,
  };
}
