import React, { useState, useEffect } from 'react';
import { Plus, Send, Clock, CheckCircle, Eye, Edit, Copy, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MarketingEmailComposer } from './MarketingEmailComposer';

interface MarketingEmail {
  id: string;
  subject: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent';
  scheduled_for: string | null;
  sent_at: string | null;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  created_at: string;
}

export function MarketingEmailsPanel() {
  const [emails, setEmails] = useState<MarketingEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(() => {
    const saved = sessionStorage.getItem('marketingEmailComposerOpen');
    return saved === 'true';
  });
  const [editingEmail, setEditingEmail] = useState<string | null>(() => {
    return sessionStorage.getItem('marketingEmailEditingId');
  });
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadEmails();
  }, []);

  useEffect(() => {
    sessionStorage.setItem('marketingEmailComposerOpen', showComposer.toString());
    if (editingEmail) {
      sessionStorage.setItem('marketingEmailEditingId', editingEmail);
    } else {
      sessionStorage.removeItem('marketingEmailEditingId');
    }
  }, [showComposer, editingEmail]);

  const loadEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('marketing_emails')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error('Error loading marketing emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email campaign? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('marketing_emails')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadEmails();
    } catch (error) {
      console.error('Error deleting email:', error);
      alert('Failed to delete email');
    }
  };

  const handleDuplicate = async (email: MarketingEmail) => {
    try {
      const { data: emailData } = await supabase
        .from('marketing_emails')
        .select('*')
        .eq('id', email.id)
        .single();

      if (!emailData) return;

      const { error } = await supabase
        .from('marketing_emails')
        .insert({
          subject: `${emailData.subject} (Copy)`,
          content_description: emailData.content_description,
          special_notes: emailData.special_notes,
          html_content: emailData.html_content,
          recipient_filter: emailData.recipient_filter,
          status: 'draft'
        });

      if (error) throw error;
      await loadEmails();
    } catch (error) {
      console.error('Error duplicating email:', error);
      alert('Failed to duplicate email');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <Edit className="w-4 h-4" />;
      case 'scheduled':
        return <Clock className="w-4 h-4" />;
      case 'sending':
        return <Send className="w-4 h-4" />;
      case 'sent':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'text-gray-400';
      case 'scheduled':
        return 'text-yellow-400';
      case 'sending':
        return 'text-blue-400';
      case 'sent':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  const filteredEmails = filterStatus === 'all'
    ? emails
    : emails.filter(e => e.status === filterStatus);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSuccessRate = (email: MarketingEmail) => {
    if (email.total_recipients === 0) return '-';
    const rate = (email.successful_sends / email.total_recipients) * 100;
    return `${rate.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Loading marketing emails...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Marketing Emails</h2>
          <p className="text-gray-400 mt-1">Create and manage email campaigns</p>
        </div>
        <button
          onClick={() => {
            setEditingEmail(null);
            setShowComposer(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all"
        >
          <Plus className="w-5 h-5" />
          Create New Email
        </button>
      </div>

      <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
        {['all', 'draft', 'scheduled', 'sent'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-md capitalize transition-colors ${
              filterStatus === status
                ? 'bg-slate-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 border-b border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Recipients
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Success Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {filteredEmails.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No marketing emails found. Create your first campaign!
                </td>
              </tr>
            ) : (
              filteredEmails.map((email) => (
                <tr key={email.id} className="hover:bg-slate-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-white font-medium">{email.subject}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`flex items-center gap-2 ${getStatusColor(email.status)}`}>
                      {getStatusIcon(email.status)}
                      <span className="capitalize">{email.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {email.total_recipients > 0 ? email.total_recipients : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-300">
                      {getSuccessRate(email)}
                      {email.status === 'sent' && email.failed_sends > 0 && (
                        <span className="text-red-400 text-sm ml-2">
                          ({email.failed_sends} failed)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {email.status === 'scheduled'
                      ? formatDate(email.scheduled_for)
                      : email.status === 'sent'
                      ? formatDate(email.sent_at)
                      : formatDate(email.created_at)
                    }
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingEmail(email.id);
                          setShowComposer(true);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                        title="View/Edit"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(email)}
                        className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {email.status === 'draft' && (
                        <button
                          onClick={() => handleDelete(email.id)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showComposer && (
        <MarketingEmailComposer
          emailId={editingEmail}
          onClose={() => {
            setShowComposer(false);
            setEditingEmail(null);
            loadEmails();
          }}
        />
      )}
    </div>
  );
}
