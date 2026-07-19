import { useState, useMemo } from 'react';
import type { Volunteer } from '../types';

export function useVolunteerFilters(
  baseVolunteers: Volunteer[],
  allVolunteers: Volunteer[],
  activeEventId: string,
) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [showMinistryDropdown, setShowMinistryDropdown] = useState(false);

  // Compile unique roles for active event scope
  const allUniqueRoles = Array.from(new Set(
    allVolunteers
      .map(v => v.eventAssignments?.[activeEventId]?.role)
      .filter((r): r is string => !!r && r.trim() !== '')
  )).sort((a, b) => a.localeCompare(b));

  const hasUnassigned = allVolunteers.some(v => !v.eventAssignments?.[activeEventId]?.role);

  // Derive distinct skills across all volunteers
  const allUniqueSkills = useMemo(() => {
    const skillsSet = new Set<string>();
    allVolunteers.forEach(v => {
      if (v.skills) {
        v.skills.split(',').forEach(s => {
          const trimmed = s.trim();
          if (trimmed) {
            const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
            skillsSet.add(formatted);
          }
        });
      }
    });
    return Array.from(skillsSet).sort((a, b) => a.localeCompare(b));
  }, [allVolunteers]);

  // Distinct ministries, grouped case-insensitively.
  const allUniqueMinistries = useMemo(() => {
    const casingCounts = new Map<string, Map<string, number>>();
    allVolunteers.forEach(v => {
      if (!v.ministry) return;
      v.ministry.split(',').forEach(m => {
        const token = m.trim();
        if (!token) return;
        const key = token.toLowerCase();
        if (!casingCounts.has(key)) casingCounts.set(key, new Map());
        const inner = casingCounts.get(key)!;
        inner.set(token, (inner.get(token) || 0) + 1);
      });
    });
    const result: string[] = [];
    casingCounts.forEach(inner => {
      let best = '';
      let bestCount = -1;
      inner.forEach((count, casing) => {
        if (count > bestCount || (count === bestCount && casing.localeCompare(best) < 0)) {
          best = casing;
          bestCount = count;
        }
      });
      result.push(best);
    });
    return result.sort((a, b) => a.localeCompare(b));
  }, [allVolunteers]);

  // Apply search & multi-select role/skill/ministry filters
  const filteredVolunteers = useMemo(() => {
    return baseVolunteers.filter(vol => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch = !query ||
        vol.name.toLowerCase().includes(query) ||
        vol.email.toLowerCase().includes(query) ||
        (vol.phone && vol.phone.toLowerCase().includes(query)) ||
        (vol.skills && vol.skills.toLowerCase().includes(query)) ||
        (vol.notes && vol.notes.toLowerCase().includes(query)) ||
        (vol.eventAssignments?.[activeEventId]?.station && vol.eventAssignments[activeEventId].station.toLowerCase().includes(query)) ||
        (vol.eventAssignments?.[activeEventId]?.role && vol.eventAssignments[activeEventId].role.toLowerCase().includes(query));
      if (!matchesSearch) return false;

      if (selectedRoles.length > 0) {
        const role = vol.eventAssignments?.[activeEventId]?.role;
        const mappedRole = (!role || role.trim() === '') ? 'Unassigned' : role;
        if (!selectedRoles.includes(mappedRole)) return false;
      }

      if (selectedSkills.length > 0) {
        if (!vol.skills) return false;
        const volSkillsList = vol.skills.split(',').map(s => {
          const trimmed = s.trim();
          return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
        });
        const hasMatchingSkill = selectedSkills.some(skill => volSkillsList.includes(skill));
        if (!hasMatchingSkill) return false;
      }

      if (selectedMinistries.length > 0) {
        if (!vol.ministry) return false;
        const volMinistries = vol.ministry.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
        const selectedLower = selectedMinistries.map(m => m.toLowerCase());
        const hasMatchingMinistry = selectedLower.some(m => volMinistries.includes(m));
        if (!hasMatchingMinistry) return false;
      }

      return true;
    });
  }, [baseVolunteers, searchTerm, selectedRoles, selectedSkills, selectedMinistries, activeEventId]);

  return {
    searchTerm, setSearchTerm,
    selectedRoles, setSelectedRoles, showRoleDropdown, setShowRoleDropdown,
    selectedSkills, setSelectedSkills, showSkillDropdown, setShowSkillDropdown,
    selectedMinistries, setSelectedMinistries, showMinistryDropdown, setShowMinistryDropdown,
    allUniqueRoles, hasUnassigned, allUniqueSkills, allUniqueMinistries,
    filteredVolunteers,
  };
}
