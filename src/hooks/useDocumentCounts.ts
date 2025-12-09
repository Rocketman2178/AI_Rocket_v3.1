import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface DocumentCounts {
  strategy: number;
  meetings: number;
  financial: number;
  projects: number;
  total: number;
}

export function useDocumentCounts() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<DocumentCounts>({
    strategy: 0,
    meetings: 0,
    financial: 0,
    projects: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's team_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('team_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      const teamId = userData?.team_id;
      if (!teamId) {
        setCounts({ strategy: 0, meetings: 0, financial: 0, projects: 0, total: 0 });
        setLoading(false);
        return;
      }

      // Use the documents table which has one row per unique document (much simpler!)
      const { data: allDocs, error: docsError } = await supabase
        .from('documents')
        .select('source_id, folder_type')
        .eq('team_id', teamId);

      if (docsError) throw docsError;

      // Count documents by folder type
      const uniqueStrategy = allDocs?.filter(d => d.folder_type === 'strategy').length || 0;
      const uniqueMeetings = allDocs?.filter(d => d.folder_type === 'meetings').length || 0;
      const uniqueFinancial = allDocs?.filter(d => d.folder_type === 'financial').length || 0;
      const uniqueProjects = allDocs?.filter(d => d.folder_type === 'projects').length || 0;

      const newCounts = {
        strategy: uniqueStrategy,
        meetings: uniqueMeetings,
        financial: uniqueFinancial,
        projects: uniqueProjects,
        total: uniqueStrategy + uniqueMeetings + uniqueFinancial + uniqueProjects
      };

      setCounts(newCounts);
      setError(null);
    } catch (err) {
      console.error('Error fetching document counts:', err);
      setError('Failed to load document counts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Calculate fuel level based on counts
  const calculateFuelLevel = useCallback((): number => {
    const { strategy, meetings, financial, projects } = counts;

    // Level 5: 10 strategy, 10 projects, 100 meetings, 10 financial
    if (strategy >= 10 && projects >= 10 && meetings >= 100 && financial >= 10) {
      return 5;
    }

    // Level 4: 10 strategy, 10 projects, 50 meetings, 10 financial
    if (strategy >= 10 && projects >= 10 && meetings >= 50 && financial >= 10) {
      return 4;
    }

    // Level 3: 3 strategy, 3 projects, 10 meetings, 3 financial
    if (strategy >= 3 && projects >= 3 && meetings >= 10 && financial >= 3) {
      return 3;
    }

    // Level 2: At least 1 from each category (including projects)
    if (strategy >= 1 && projects >= 1 && meetings >= 1 && financial >= 1) {
      return 2;
    }

    // Level 1: At least 1 document total
    if (counts.total >= 1) {
      return 1;
    }

    // Level 0: No documents
    return 0;
  }, [counts]);

  // Get requirements for next level
  const getNextLevelRequirements = useCallback((currentLevel: number): string[] => {
    switch (currentLevel) {
      case 0:
        return ['Upload or create at least 1 document (any category)'];
      case 1:
        return [
          '1 Strategy Document',
          '1 Project Document',
          '1 Meeting Document',
          '1 Financial Document'
        ];
      case 2:
        return [
          '3 Strategy Documents',
          '3 Project Documents',
          '10 Meeting Documents',
          '3 Financial Documents'
        ];
      case 3:
        return [
          '10 Strategy Documents',
          '10 Project Documents',
          '50 Meeting Documents',
          '10 Financial Documents'
        ];
      case 4:
        return [
          '10 Strategy Documents',
          '10 Project Documents',
          '100 Meeting Documents',
          '10 Financial Documents'
        ];
      case 5:
        return ['Maximum level reached!'];
      default:
        return [];
    }
  }, []);

  // Check if requirements are met for a specific level
  const meetsLevelRequirements = useCallback((level: number): boolean => {
    const { strategy, meetings, financial, projects } = counts;

    switch (level) {
      case 1:
        return counts.total >= 1;
      case 2:
        return strategy >= 1 && projects >= 1 && meetings >= 1 && financial >= 1;
      case 3:
        return strategy >= 3 && projects >= 3 && meetings >= 10 && financial >= 3;
      case 4:
        return strategy >= 10 && projects >= 10 && meetings >= 50 && financial >= 10;
      case 5:
        return strategy >= 10 && projects >= 10 && meetings >= 100 && financial >= 10;
      default:
        return false;
    }
  }, [counts]);

  useEffect(() => {
    if (user) {
      fetchCounts();
    }
  }, [user, fetchCounts]);

  // Real-time subscription for document changes
  useEffect(() => {
    if (!user) return;

    // Subscribe to changes in the documents table (much simpler - one table!)
    const subscription = supabase
      .channel('document_count_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchCounts]);

  return {
    counts,
    loading,
    error,
    calculateFuelLevel,
    getNextLevelRequirements,
    meetsLevelRequirements,
    refresh: fetchCounts
  };
}
