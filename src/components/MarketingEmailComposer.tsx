import React, { useState, useEffect } from 'react';
import { X, Sparkles, Eye, Code, Send, Clock, Mail, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getFeatureContext } from '../lib/marketing-context';

interface MarketingEmailComposerProps {
  emailId: string | null;
  onClose: () => void;
}

interface EmailData {
  subject: string;
  content_description: string;
  special_notes: string;
  html_content: string;
  recipient_filter: {
    type: 'all' | 'specific';
    emails?: string[];
  };
  scheduled_for: string | null;
  context_type?: 'full' | 'core' | 'benefits' | 'useCases';
}

const INITIAL_DATA: EmailData = {
  subject: '',
  content_description: '',
  special_notes: '',
  html_content: '',
  recipient_filter: { type: 'all' },
  scheduled_for: null,
  context_type: 'full'
};

export function MarketingEmailComposer({ emailId, onClose }: MarketingEmailComposerProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [emailData, setEmailData] = useState<EmailData>(INITIAL_DATA);
  const [regenerationComments, setRegenerationComments] = useState('');
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });
  const [allUsers, setAllUsers] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>('immediate');
  const [draftId, setDraftId] = useState<string | null>(emailId);

  useEffect(() => {
    if (emailId) {
      loadEmail();
    }
    loadUsers();
  }, [emailId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (emailData.subject || emailData.content_description) {
        saveDraft();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [emailData.subject, emailData.content_description, emailData.special_notes, emailData.context_type]);

  const loadEmail = async () => {
    try {
      const { data, error } = await supabase
        .from('marketing_emails')
        .select('*')
        .eq('id', emailId)
        .single();

      if (error) throw error;
      if (data) {
        setEmailData({
          subject: data.subject,
          content_description: data.content_description,
          special_notes: data.special_notes,
          html_content: data.html_content,
          recipient_filter: data.recipient_filter,
          scheduled_for: data.scheduled_for
        });
        if (data.html_content) {
          setStep(2);
        }
      }
    } catch (error) {
      console.error('Error loading email:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name')
        .order('name');

      if (error) throw error;
      setAllUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const generateEmail = async () => {
    setGenerating(true);
    try {
      const featureContext = getFeatureContext(emailData.context_type || 'full');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-marketing-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: emailData.subject,
            contentDescription: emailData.content_description,
            specialNotes: emailData.special_notes,
            previousHtml: emailData.html_content || undefined,
            regenerationComments: regenerationComments || undefined,
            featureContext
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Generate email error:', errorData);
        throw new Error(errorData.error || 'Failed to generate email');
      }

      const result = await response.json();
      setEmailData(prev => ({ ...prev, html_content: result.html }));
      setRegenerationComments('');
      setStep(2);

      await saveDraft();
    } catch (error) {
      console.error('Error generating email:', error);
      alert(`Failed to generate email: ${error.message}\n\nPlease ensure GEMINI_API_KEY is configured in Supabase secrets.`);
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async () => {
    try {
      const payload = {
        subject: emailData.subject,
        content_description: emailData.content_description,
        special_notes: emailData.special_notes,
        html_content: emailData.html_content,
        recipient_filter: emailData.recipient_filter,
        scheduled_for: emailData.scheduled_for,
        status: 'draft'
      };

      if (draftId) {
        const { error } = await supabase
          .from('marketing_emails')
          .update(payload)
          .eq('id', draftId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('marketing_emails')
          .insert({ ...payload, created_by: user?.id })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          setDraftId(data.id);
          sessionStorage.setItem('marketingEmailEditingId', data.id);
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  };

  const sendTestEmail = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-marketing-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipientEmails: [user.email],
            subject: emailData.subject,
            htmlContent: emailData.html_content
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send test email');
      alert('Test email sent to your inbox!');
    } catch (error) {
      console.error('Error sending test email:', error);
      alert('Failed to send test email');
    }
  };

  const sendEmail = async () => {
    if (!confirm(`Send this email to ${getRecipientCount()} recipients?`)) {
      return;
    }

    setSending(true);
    try {
      let finalEmailId = emailId;

      if (!emailId) {
        const { data, error } = await supabase
          .from('marketing_emails')
          .insert({
            subject: emailData.subject,
            content_description: emailData.content_description,
            special_notes: emailData.special_notes,
            html_content: emailData.html_content,
            recipient_filter: emailData.recipient_filter,
            scheduled_for: emailData.scheduled_for,
            status: scheduleType === 'scheduled' ? 'scheduled' : 'sending',
            created_by: user?.id
          })
          .select()
          .single();

        if (error) throw error;
        finalEmailId = data.id;
      } else {
        const { error } = await supabase
          .from('marketing_emails')
          .update({
            status: scheduleType === 'scheduled' ? 'scheduled' : 'sending',
            scheduled_for: emailData.scheduled_for
          })
          .eq('id', emailId);

        if (error) throw error;
      }

      if (scheduleType === 'scheduled') {
        alert('Email scheduled successfully!');
        onClose();
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-marketing-email-campaign`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            marketingEmailId: finalEmailId,
            recipientFilter: emailData.recipient_filter
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to send email');

      const result = await response.json();
      alert(`Email campaign sent! ${result.successful_sends} successful, ${result.failed_sends} failed.`);
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email campaign');
    } finally {
      setSending(false);
    }
  };

  const getRecipientCount = () => {
    if (emailData.recipient_filter.type === 'all') {
      return allUsers.length;
    }
    return selectedUserIds.length;
  };

  const canProceedFromStep1 = emailData.subject && emailData.content_description;
  const canProceedFromStep2 = emailData.html_content;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {emailId ? 'Edit Marketing Email' : 'Create Marketing Email'}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all ${
                    s <= step ? 'bg-blue-500 w-16' : 'bg-slate-700 w-12'
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Email Details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Subject Line * <span className="text-xs text-gray-500">(Emojis supported: 🚀✨💡)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={emailData.subject}
                        onChange={(e) => setEmailData(prev => ({ ...prev, subject: e.target.value }))}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        placeholder="e.g., 🚀 Exciting New Features Now Available!"
                        maxLength={150}
                        spellCheck={true}
                        autoComplete="off"
                        style={{ unicodeBidi: 'plaintext' }}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEmailData(prev => ({ ...prev, subject: prev.subject + '🚀' }))}
                          className="text-xl hover:scale-110 transition-transform"
                          title="Add rocket emoji"
                        >
                          🚀
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailData(prev => ({ ...prev, subject: prev.subject + '✨' }))}
                          className="text-xl hover:scale-110 transition-transform"
                          title="Add sparkles emoji"
                        >
                          ✨
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailData(prev => ({ ...prev, subject: prev.subject + '💡' }))}
                          className="text-xl hover:scale-110 transition-transform"
                          title="Add lightbulb emoji"
                        >
                          💡
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Tip: You can paste emojis directly or use the buttons above
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Content Description *
                    </label>
                    <textarea
                      value={emailData.content_description}
                      onChange={(e) => setEmailData(prev => ({ ...prev, content_description: e.target.value }))}
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Describe what this email should communicate to users..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Feature Context
                    </label>
                    <select
                      value={emailData.context_type}
                      onChange={(e) => setEmailData(prev => ({ ...prev, context_type: e.target.value as any }))}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="full">Full Context (All features & benefits)</option>
                      <option value="core">Core Features Only</option>
                      <option value="benefits">Benefits Focus</option>
                      <option value="useCases">Use Cases Focus</option>
                    </select>
                    <p className="text-sm text-gray-400 mt-2">
                      Choose how much product context to include. Full context provides the most detail about features.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Special Notes / Instructions
                    </label>
                    <textarea
                      value={emailData.special_notes}
                      onChange={(e) => setEmailData(prev => ({ ...prev, special_notes: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                      placeholder="Any specific instructions for the AI (tone, key points, CTAs, etc.)..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Preview & Edit</h3>
                <button
                  onClick={() => setShowHtmlEditor(!showHtmlEditor)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  {showHtmlEditor ? <Eye className="w-4 h-4" /> : <Code className="w-4 h-4" />}
                  {showHtmlEditor ? 'Show Preview' : 'Edit HTML'}
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  {showHtmlEditor ? (
                    <textarea
                      value={emailData.html_content}
                      onChange={(e) => setEmailData(prev => ({ ...prev, html_content: e.target.value }))}
                      className="w-full h-[600px] px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                  ) : (
                    <div className="bg-white rounded-lg overflow-hidden">
                      <iframe
                        srcDoc={emailData.html_content}
                        className="w-full h-[600px]"
                        title="Email Preview"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-800 rounded-lg p-4">
                    <h4 className="font-semibold text-white mb-3">Regenerate Email</h4>
                    <textarea
                      value={regenerationComments}
                      onChange={(e) => setRegenerationComments(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none mb-3"
                      placeholder="Provide feedback to improve the email..."
                    />
                    <button
                      onClick={generateEmail}
                      disabled={generating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      {generating ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  </div>

                  <div className="bg-slate-800 rounded-lg p-4">
                    <h4 className="font-semibold text-white mb-3">Test Email</h4>
                    <button
                      onClick={sendTestEmail}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Send to Me
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <h3 className="text-xl font-bold text-white">Select Recipients</h3>

              <div className="space-y-4">
                <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                  <input
                    type="radio"
                    checked={emailData.recipient_filter.type === 'all'}
                    onChange={() => setEmailData(prev => ({
                      ...prev,
                      recipient_filter: { type: 'all' }
                    }))}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="text-white font-medium">All Users</div>
                    <div className="text-sm text-gray-400">Send to all {allUsers.length} users</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                  <input
                    type="radio"
                    checked={emailData.recipient_filter.type === 'specific'}
                    onChange={() => setEmailData(prev => ({
                      ...prev,
                      recipient_filter: { type: 'specific', emails: [] }
                    }))}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="text-white font-medium">Specific Users</div>
                    <div className="text-sm text-gray-400">Choose specific recipients</div>
                  </div>
                </label>

                {emailData.recipient_filter.type === 'specific' && (
                  <div className="ml-7 mt-3 max-h-64 overflow-y-auto bg-slate-900 rounded-lg p-4 space-y-2">
                    {allUsers.map(user => (
                      <label key={user.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-800 p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(prev => [...prev, user.id]);
                            } else {
                              setSelectedUserIds(prev => prev.filter(id => id !== user.id));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="text-white text-sm">{user.name || user.email}</div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-300 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span className="font-medium">{getRecipientCount()} recipients selected</span>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <h3 className="text-xl font-bold text-white">Schedule & Send</h3>

              <div className="space-y-4">
                <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                  <input
                    type="radio"
                    checked={scheduleType === 'immediate'}
                    onChange={() => setScheduleType('immediate')}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="text-white font-medium">Send Immediately</div>
                    <div className="text-sm text-gray-400">Send to all recipients right away</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-4 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                  <input
                    type="radio"
                    checked={scheduleType === 'scheduled'}
                    onChange={() => setScheduleType('scheduled')}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="text-white font-medium">Schedule for Later</div>
                    <div className="text-sm text-gray-400">Choose a specific date and time</div>
                  </div>
                </label>

                {scheduleType === 'scheduled' && (
                  <div className="ml-7 mt-3">
                    <input
                      type="datetime-local"
                      value={emailData.scheduled_for || ''}
                      onChange={(e) => setEmailData(prev => ({
                        ...prev,
                        scheduled_for: e.target.value
                      }))}
                      className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="bg-slate-800 rounded-lg p-6 space-y-3">
                <h4 className="font-semibold text-white">Campaign Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subject:</span>
                    <span className="text-white font-medium">{emailData.subject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Recipients:</span>
                    <span className="text-white font-medium">{getRecipientCount()} users</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Send Time:</span>
                    <span className="text-white font-medium">
                      {scheduleType === 'immediate' ? 'Immediately' : 'Scheduled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-slate-700">
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          <div className="flex items-center gap-3">
            {step === 1 && (
              <button
                onClick={generateEmail}
                disabled={!canProceedFromStep1 || generating}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Sparkles className="w-5 h-5" />
                {generating ? 'Generating...' : 'Generate Preview'}
              </button>
            )}

            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedFromStep2}
                className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={() => setStep(4)}
                disabled={getRecipientCount() === 0}
                className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {step === 4 && (
              <button
                onClick={sendEmail}
                disabled={sending}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {scheduleType === 'scheduled' ? (
                  <>
                    <Clock className="w-5 h-5" />
                    {sending ? 'Scheduling...' : 'Schedule Email'}
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    {sending ? 'Sending...' : 'Send Email'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
