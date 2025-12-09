import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ReplyState } from '../types';
import { useChats } from './useChats';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { N8NTemplate } from '../lib/n8n-templates';
import { n8nService } from '../lib/n8n-service';
import { useMetricsTracking } from './useMetricsTracking';

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;

export const useChat = () => {
  const { logChatMessage, currentMessages, currentConversationId, loading: chatsLoading, loadConversation, startNewConversation: chatsStartNewConversation, updateVisualizationStatus, conversations, hasInitialized, getVisualizationState, updateVisualizationState, updateVisualizationData } = useChats();
  const { user } = useAuth();
  const { trackMessageSent, trackAIPerformance } = useMetricsTracking();
  const [userProfile, setUserProfile] = useState<{ name: string | null } | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: "Welcome, I'm Astra. What can I help you with today?",
      isUser: false,
      timestamp: new Date(),
      isCentered: true
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasLoadedConversation, setHasLoadedConversation] = useState(false);
  const [replyState, setReplyState] = useState<ReplyState>({
    isReplying: false,
    messageId: null,
    messageSnippet: null
  });

  // Fetch user profile when user changes
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('name')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          return;
        }

        setUserProfile(data);
      } catch (err) {
        console.error('Error in fetchUserProfile:', err);
      }
    };

    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  // Convert database messages to UI messages
  useEffect(() => {
    console.log('useChat: currentMessages changed', { 
      currentMessagesLength: currentMessages.length, 
      currentConversationId, 
      chatsLoading,
      isLoading
    });
    
    if (currentMessages.length > 0) {
      const uiMessages: Message[] = [];
      
      currentMessages.forEach((dbMessage, index) => {
        if (dbMessage.isUser) {
          // Add user message
          uiMessages.push({
            id: `${dbMessage.id}-user`,
            text: dbMessage.message,
            isUser: true,
            timestamp: new Date(dbMessage.createdAt),
            messageType: 'user',
            isReply: dbMessage.message.startsWith('@reply '),
            replyToId: dbMessage.message.startsWith('@reply ') ? dbMessage.message.split(' ')[1] : undefined
          });
        } else {
          // Add Astra response
          uiMessages.push({
            id: `${dbMessage.id}-astra`,
            text: dbMessage.message,
            isUser: false,
            timestamp: new Date(dbMessage.createdAt),
            chatId: dbMessage.id,
            visualization: !!dbMessage.visualizationData,
            hasStoredVisualization: !!dbMessage.visualizationData,
            visualization_data: dbMessage.visualizationData,
            messageType: 'astra',
            metadata: dbMessage.metadata || {}
          });
          
          console.log('🔍 useChat: Added Astra message with visualization data:', {
            chatId: dbMessage.id,
            hasVisualizationData: !!dbMessage.visualizationData,
            visualizationDataLength: dbMessage.visualizationData?.length || 0
          });
        }
      });
      
      console.log('useChat: Setting messages from database', { uiMessagesLength: uiMessages.length });
      setMessages([
        {
          id: 'welcome',
          text: "Welcome, I'm Astra. What can I help you with today?",
          isUser: false,
          timestamp: new Date(),
          isCentered: true
        },
        ...uiMessages
      ]);
    } else if (!currentConversationId || (currentMessages.length === 0 && !chatsLoading)) {
      // Reset to welcome message for new conversations
      console.log('useChat: Resetting to welcome message', {
        hasConversationId: !!currentConversationId,
        currentMessagesLength: currentMessages.length,
        chatsLoading,
        isLoading
      });
      setMessages([
        {
          id: 'welcome',
          text: "Welcome, I'm Astra. What can I help you with today?",
          isUser: false,
          timestamp: new Date(),
          isCentered: true
        }
      ]);
    }
  }, [currentMessages, currentConversationId, chatsLoading]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    let messageToSend = text.trim();
    let isReplyMessage = false;
    
    // Check if we're in reply mode
    if (replyState.isReplying && replyState.messageId) {
      messageToSend = `@reply ${replyState.messageId} ${text.trim()}`;
      isReplyMessage = true;
      console.log('🔄 Sending reply message:', messageToSend);
    }

    // Check if webhook URL is configured
    if (!WEBHOOK_URL) {
      console.error('N8N webhook URL not configured');
      const errorMessage: Message = {
        id: `${uuidv4()}-error`,
        text: "Configuration error: N8N webhook URL not set. Please check your environment variables.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    // Get user information - FETCH FROM public.users (source of truth)
    const userId = user?.id || '';
    const userEmail = user?.email || '';

    // Fetch user data from public.users table (source of truth)
    let teamId = '';
    let teamName = '';
    let role = 'member';
    let viewFinancial = true;
    let userName = userProfile?.name || user?.email?.split('@')[0] || 'Unknown User';

    try {
      // Use database function to fetch user data with team name (bypasses RLS issues)
      const { data: userData, error: userError } = await supabase
        .rpc('get_user_team_info', { p_user_id: userId });

      if (userError || !userData || userData.length === 0) {
        console.error('Error fetching user data from database function:', userError);
        // Fallback to user_metadata if function call fails
        teamId = user?.user_metadata?.team_id || '';
        role = user?.user_metadata?.role || 'member';
        viewFinancial = user?.user_metadata?.view_financial !== false;
      } else {
        const userInfo = userData[0];
        teamId = userInfo.team_id || '';
        teamName = userInfo.team_name || '';
        role = userInfo.role || 'member';
        viewFinancial = userInfo.view_financial !== false;
        userName = userInfo.user_name || userName;

        console.log('✅ Fetched user data from database:', {
          teamId,
          teamName,
          role,
          viewFinancial,
          userName
        });
      }
    } catch (err) {
      console.error('Error in user data fetch:', err);
      // Fallback to user_metadata
      teamId = user?.user_metadata?.team_id || '';
      role = user?.user_metadata?.role || 'member';
      viewFinancial = user?.user_metadata?.view_financial !== false;
    }

    const messageId = uuidv4();
    const startTime = Date.now();
    const userMessage: Message = {
      id: `${messageId}-user`,
      text: messageToSend,
      isUser: true,
      timestamp: new Date(),
      messageType: 'user',
      isReply: isReplyMessage,
      replyToId: replyState.isReplying ? replyState.messageId : undefined
    };

    // Add user message to UI immediately
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    // Clear reply state after sending
    if (replyState.isReplying) {
      setReplyState({
        isReplying: false,
        messageId: null,
        messageSnippet: null
      });
    }

    try {
      const requestStartTime = Date.now();
      
      console.log('🌐 Sending request to webhook:', WEBHOOK_URL);
      console.log('📤 Request payload:', {
        chatInput: messageToSend,
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        conversation_id: currentConversationId,
        team_id: teamId,
        team_name: teamName,
        role: role,
        view_financial: viewFinancial,
        mode: 'private'
      });

      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatInput: messageToSend,
          user_id: userId,
          user_email: userEmail,
          user_name: userName,
          conversation_id: currentConversationId,
          team_id: teamId,
          team_name: teamName,
          role: role,
          view_financial: viewFinancial,
          mode: 'private'
        })
      });
      const requestEndTime = Date.now();
      const responseTimeMs = requestEndTime - requestStartTime;

      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Webhook request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
        
        // Try to parse error response and extract meaningful message
        let errorMessage = `Webhook request failed: ${response.status} ${response.statusText}`;
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
              errorMessage = `Server error: ${errorJson.message}`;
            } else {
              errorMessage += ` - ${errorText}`;
            }
          } catch (parseError) {
            // If not JSON, use raw error text
            errorMessage += ` - ${errorText}`;
          }
        }
        
        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      
      // Try to parse JSON response and extract the output field
      let messageText = responseText;
      let metadata: any = {};
      let tokensUsed: any = {};
      let toolsUsed: string[] = [];
      
      try {
        const jsonResponse = JSON.parse(responseText);
        if (jsonResponse.output) {
          messageText = jsonResponse.output;
        }

        // Extract additional metadata if available from n8n response
        if (jsonResponse.metadata) {
          metadata = jsonResponse.metadata;
        }
        if (jsonResponse.tokens_used) {
          tokensUsed = jsonResponse.tokens_used;
        }
        if (jsonResponse.tools_used) {
          toolsUsed = jsonResponse.tools_used;
        }
        if (jsonResponse.model_used) {
          metadata.model_used = jsonResponse.model_used;
        }
      } catch (e) {
        // If it's not JSON, use the raw text
        messageText = responseText;
      }

      // Check if the response is empty or invalid
      if (!messageText || messageText.trim() === '' || messageText.trim() === '""' || messageText === '""') {
        console.error('❌ Received empty or invalid response from Astra');
        messageText = "⚠️ I apologize, but I wasn't able to generate a response.\n\n**What you can try:**\n• Rephrase your question and try again\n• Check if you have the necessary data uploaded\n• Make your question more specific\n\nIf this issue continues, please use the Help menu to contact support.";
      }

      console.log('✅ Received Astra response:', { messageText: messageText.substring(0, 100) + '...' });

      const astraMessage: Message = {
        id: `${messageId}-astra`,
        text: messageText,
        isUser: false,
        timestamp: new Date(),
        messageType: 'astra'
      };

      // Add Astra response to UI immediately
      setMessages(prev => [...prev, astraMessage]);

      console.log('✅ Added Astra message to UI, current message count:', messages.length + 1);

      // Log the chat message to database
      try {
        // Log user message
        const userChatId = await logChatMessage(
          text.trim(), // Log original text, not formatted version
          true, // isUser
          currentConversationId || undefined,
          0, // No response time for user messages
          {},
          undefined,
          { 
            request_time: requestStartTime,
            is_reply: isReplyMessage,
            reply_to_id: isReplyMessage ? replyState.messageId : undefined
          },
          false, // visualization
          'private', // mode
          [], // mentions
          text.trim(), // astraPrompt (original user question, without @reply formatting)
          undefined // visualizationData
        );
        
        console.log('✅ Logged user message to database:', userChatId);
        
        // Log Astra response
        const chatId = await logChatMessage(
          messageText,
          false, // isUser (Astra response)
          currentConversationId || undefined,
          responseTimeMs,
          tokensUsed,
          metadata.model_used || 'n8n-workflow',
          {
            ...metadata,
            request_time: requestStartTime,
            response_time: requestEndTime,
            total_processing_time: responseTimeMs
          },
          false, // visualization
          'private', // mode
          [], // mentions
          text.trim(), // astraPrompt (original user question)
          undefined // visualizationData
        );
        
        console.log('✅ Logged Astra response to database:', chatId);

        // Track metrics for successful message
        if (chatId) {
          trackMessageSent(chatId, 'private');
          trackAIPerformance({
            chatId: chatId,
            responseTimeMs: responseTimeMs,
            success: true,
            mode: 'chat'
          });
        }

        // Refresh messages to ensure UI is updated with database changes
        await refreshMessages();

        // Update the message in state with the database chatId
        if (chatId) {
          setMessages(prev => prev.map(msg =>
            msg.id === astraMessage.id
              ? { ...msg, chatId: chatId }
              : msg
          ));
          console.log('✅ Updated Astra message with chatId:', chatId);
        }
      } catch (error) {
        console.error('Failed to log chat message:', error);
        // Don't block the UI if logging fails
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Track failed AI response
      const failedDuration = Date.now() - startTime;
      trackAIPerformance({
        responseTimeMs: failedDuration,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        mode: 'chat'
      });
      
      let errorMessage = "⚠️ I'm having trouble connecting right now.\n\n**What you can try:**\n• Wait a moment and try again\n• Check your internet connection\n• Refresh the page\n\nIf this issue continues, please use the Help menu to contact support.";

      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          errorMessage = "⚠️ Network connection error.\n\n**What you can try:**\n• Check your internet connection\n• Try again in a moment\n• Refresh the page\n\nIf you're still having issues, please contact support through the Help menu.";
        } else if (error.message.includes('Webhook request failed')) {
          errorMessage = `⚠️ Server error occurred.\n\n**What you can try:**\n• Wait a moment and try again\n• Rephrase your question\n• Try a simpler query\n\nIf this persists, please contact support through the Help menu.`;
        } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
          errorMessage = "⚠️ The request took too long to complete.\n\n**What you can try:**\n• Try a more specific question\n• Break your question into smaller parts\n• Wait a moment and try again\n\nIf you need help, please contact support through the Help menu.";
        }
      }
      
      const errorMessageObj: Message = {
        id: `${messageId}-error`,
        text: errorMessage,
        isUser: false,
        timestamp: new Date(),
        messageType: 'system'
      };
      setMessages(prev => [...prev, errorMessageObj]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, logChatMessage, currentConversationId, updateVisualizationStatus, user, userProfile, replyState]);

  // Load the most recent conversation when component mounts or when returning to private chat
  useEffect(() => {
    // Check for pending summary request
    const pendingSummaryRequest = localStorage.getItem('pendingSummaryRequest');
    if (pendingSummaryRequest) {
      localStorage.removeItem('pendingSummaryRequest');
      
      const summaryPrompts = {
        '24hours': 'Please provide a comprehensive summary of our team chat from the last 24 hours. Include key decisions, action items, and important discussions.',
        '7days': 'Please provide a comprehensive summary of our team chat from the last 7 days. Include key decisions, action items, and important discussions.',
        '30days': 'Please provide a comprehensive summary of our team chat from the last 30 days. Include key decisions, action items, and important discussions.'
      };
      
      const prompt = summaryPrompts[pendingSummaryRequest as keyof typeof summaryPrompts];
      if (prompt) {
        // Auto-send the summary request
        setTimeout(() => {
          sendMessage(prompt);
        }, 500);
      }
      return;
    }
    
    if (user && hasInitialized && !currentConversationId) {
      // If there are existing conversations, load the most recent one
      if (conversations.length > 0) {
        const mostRecentConversation = conversations[0];
        console.log('useChat: Loading most recent conversation:', mostRecentConversation.id);
        loadConversation(mostRecentConversation.id);
      }
    }
  }, [user, hasInitialized, conversations, currentConversationId, loadConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Force refresh of current messages after logging to ensure UI stays in sync
  const refreshMessages = useCallback(async () => {
    if (currentConversationId) {
      // Small delay to ensure database write is complete
      setTimeout(() => {
        loadConversation(currentConversationId);
      }, 100);
    }
  }, [currentConversationId, loadConversation]);

  const startReply = useCallback((messageId: string, messageText: string) => {
    const snippet = messageText.length > 100 
      ? messageText.substring(0, 100) + '...'
      : messageText;
    
    setReplyState({
      isReplying: true,
      messageId,
      messageSnippet: snippet
    });
    
    console.log('🔄 Started reply to message:', messageId);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyState({
      isReplying: false,
      messageId: null,
      messageSnippet: null
    });
    
    console.log('❌ Cancelled reply');
  }, []);
  const toggleMessageExpansion = useCallback((messageId: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, isExpanded: !msg.isExpanded }
          : msg
      )
    );
  }, []);

  const startNewConversation = useCallback(() => {
    console.log('useChat: Starting new conversation');
    const newConversationId = chatsStartNewConversation();
    console.log('useChat: New conversation ID:', newConversationId);
    return newConversationId;
  }, [chatsStartNewConversation]);

  const handleTemplateImportFromChat = useCallback(async (template: N8NTemplate): Promise<string | undefined> => {
    const loadingMessage: Message = {
      id: `importing-${template.id}`,
      text: `Importing "${template.name}"...`,
      isUser: false,
      timestamp: new Date(),
      messageType: 'system'
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const workflow = await n8nService.createWorkflow({
        name: template.name,
        nodes: template.workflow.nodes,
        connections: template.workflow.connections,
        settings: {},
      });

      await n8nService.saveWorkflowMetadata(
        workflow.id,
        template.name,
        `${template.description}\n\nImported from n8n Templates (ID: ${template.id})\nOriginal Author: ${template.user.username}\nImported via Astra AI`
      );

      setMessages(prev => prev.filter(m => m.id !== `importing-${template.id}`));

      const successMessage: Message = {
        id: `imported-${template.id}`,
        text: `✅ Successfully imported "${template.name}"`,
        isUser: false,
        timestamp: new Date(),
        messageType: 'system',
        metadata: {
          action_type: 'template_imported',
          workflow_id: workflow.id,
          template_name: template.name
        }
      };
      setMessages(prev => [...prev, successMessage]);

      return workflow.id;
    } catch (error) {
      console.error('Failed to import template:', error);
      setMessages(prev => prev.filter(m => m.id !== `importing-${template.id}`));

      const errorMessage: Message = {
        id: `error-${template.id}`,
        text: `❌ Failed to import "${template.name}". Please try again or browse templates manually.`,
        isUser: false,
        timestamp: new Date(),
        messageType: 'system'
      };
      setMessages(prev => [...prev, errorMessage]);

      return undefined;
    }
  }, [setMessages]);

  return {
    messages,
    isLoading,
    inputValue,
    setInputValue,
    sendMessage,
    toggleMessageExpansion,
    messagesEndRef,
    setMessages,
    currentConversationId,
    updateVisualizationStatus,
    loadConversation,
    startNewConversation,
    getVisualizationState: getVisualizationState,
    updateVisualizationState: updateVisualizationState,
    updateVisualizationData,
    replyState,
    startReply,
    cancelReply,
    handleTemplateImportFromChat
  };
};