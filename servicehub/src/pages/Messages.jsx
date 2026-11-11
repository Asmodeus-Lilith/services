import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../api/client';
import Icon from '../components/Icon';
import './Messages.css';

const formatMessageTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

const REPORT_REASONS = [
  ['harassment', 'Harassment or bullying'],
  ['fraud', 'Fraud or scam'],
  ['inappropriate_behavior', 'Inappropriate behavior'],
  ['service_quality', 'Service quality or conduct'],
  ['safety_concern', 'Safety concern'],
  ['other', 'Other']
];

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get('conversation') || '');
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const listEndRef = useRef(null);

  const loadInbox = useCallback(async () => {
    try {
      const data = await apiRequest('/messages/conversations');
      const next = data?.conversations ?? [];
      setConversations(next);
      setSelectedId((current) => {
        const requested = searchParams.get('conversation');
        if (requested && next.some((item) => item.id === requested)) return requested;
        if (current && next.some((item) => item.id === current)) return current;
        return next[0]?.id || '';
      });
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load your conversations');
    } finally {
      setLoadingInbox(false);
    }
  }, [searchParams]);

  const loadThread = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await apiRequest(`/messages/conversations/${encodeURIComponent(id)}/messages`);
      setConversation(data.conversation);
      setMessages(data.messages ?? []);
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'Could not load this conversation');
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
    const timer = window.setInterval(loadInbox, 15000);
    return () => window.clearInterval(timer);
  }, [loadInbox]);

  useEffect(() => {
    if (!selectedId) {
      setConversation(null);
      setMessages([]);
      return undefined;
    }
    setSearchParams({ conversation: selectedId }, { replace: true });
    setLoadingThread(true);
    loadThread(selectedId);
    const timer = window.setInterval(() => loadThread(selectedId), 5000);
    return () => window.clearInterval(timer);
  }, [selectedId, setSearchParams, loadThread]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages]);

  const selectConversation = (id) => {
    setSelectedId(id);
    setSearchParams({ conversation: id });
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = draft.trim();
    if (!selectedId || !message || sending) return;
    setSending(true);
    try {
      await apiRequest(`/messages/conversations/${encodeURIComponent(selectedId)}/messages`, {
        method: 'POST',
        body: { message }
      });
      setDraft('');
      await Promise.all([loadThread(selectedId), loadInbox()]);
    } catch (requestError) {
      setError(requestError.message || 'Could not send your message');
    } finally {
      setSending(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!selectedId || submittingReport) return;
    setSubmittingReport(true);
    try {
      await apiRequest('/reports', {
        method: 'POST',
        body: {
          conversationId: selectedId,
          reason: reportReason,
          description: reportDescription.trim()
        }
      });
      setReportOpen(false);
      setReportReason('');
      setReportDescription('');
      toast.success('Your report was sent to the ServiceHub moderation team.');
    } catch (requestError) {
      setError(requestError.message || 'Could not submit your report');
    } finally {
      setSubmittingReport(false);
    }
  };

  const confirmDeleteConversation = (e, item) => {
    e.stopPropagation();
    setConversationToDelete(item || conversation || activeInboxItem);
  };

  const executeDeleteConversation = async () => {
    if (!conversationToDelete || deletingChat) return;
    setDeletingChat(true);
    try {
      await apiRequest(`/messages/conversations/${encodeURIComponent(conversationToDelete.id)}`, {
        method: 'DELETE'
      });
      toast.success('Conversation deleted');
      const targetId = conversationToDelete.id;
      const remaining = conversations.filter((c) => c.id !== targetId);
      setConversations(remaining);
      if (selectedId === targetId) {
        const nextId = remaining[0]?.id || '';
        setSelectedId(nextId);
        setSearchParams(nextId ? { conversation: nextId } : {}, { replace: true });
        if (!nextId) {
          setConversation(null);
          setMessages([]);
        }
      }
      setConversationToDelete(null);
    } catch (requestError) {
      toast.error(requestError.message || 'Could not delete this conversation');
    } finally {
      setDeletingChat(false);
    }
  };

  const executeDeleteMessage = async (msgId) => {
    if (!selectedId || !msgId || deletingMessageId) return;
    setDeletingMessageId(msgId);
    try {
      await apiRequest(`/messages/conversations/${encodeURIComponent(selectedId)}/messages/${encodeURIComponent(msgId)}`, {
        method: 'DELETE'
      });
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      loadInbox();
      toast.success('Message deleted');
    } catch (requestError) {
      toast.error(requestError.message || 'Could not delete message');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const activeInboxItem = conversations.find((item) => item.id === selectedId);

  return (
    <div className="messages-page">
      <div className="container">
        <header className="messages-heading">
          <div>
            <span className="messages-eyebrow">SERVICEHUB MESSAGES</span>
            <h1>Messages</h1>
            <p>Talk directly with customers and service providers about a service.</p>
          </div>
        </header>

        {error && <div className="messages-error" role="alert">{error}</div>}

        <div className="messages-layout">
          <aside className="messages-inbox" aria-label="Conversations">
            <div className="messages-inbox-heading"><h2>Inbox</h2><span>{conversations.length}</span></div>
            {loadingInbox && conversations.length === 0 ? <div className="spinner" /> : conversations.length === 0 ? (
              <div className="messages-empty-inbox">
                <Icon name="message" size={28} />
                <strong>No conversations yet</strong>
                <p>Customers can message providers from a service page.</p>
              </div>
            ) : (
              <div className="messages-conversation-list">
                {conversations.map((item) => (
                  <div
                    role="button"
                    tabIndex={0}
                    key={item.id}
                    className={`messages-conversation-item ${selectedId === item.id ? 'selected' : ''}`}
                    onClick={() => selectConversation(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        selectConversation(item.id);
                      }
                    }}
                  >
                    <span className="messages-avatar">{item.otherName?.trim().charAt(0)?.toUpperCase() || '?'}</span>
                    <span className="messages-preview">
                      <span className="messages-preview-heading"><strong>{item.otherName}</strong><time>{formatMessageTime(item.lastMessageAt)}</time></span>
                      <span className="messages-service-name">{item.serviceName}</span>
                      <span className="messages-preview-body">{item.lastMessage || 'Start the conversation'}</span>
                    </span>
                    {item.unreadCount > 0 && <span className="messages-unread-count">{item.unreadCount}</span>}
                    <button
                      type="button"
                      className="messages-item-delete-btn"
                      title="Delete chat"
                      aria-label={`Delete conversation with ${item.otherName}`}
                      onClick={(e) => confirmDeleteConversation(e, item)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <section className="messages-thread" aria-label="Message conversation">
            {!selectedId ? (
              <div className="messages-thread-empty">
                <Icon name="message" size={38} />
                <h2>Your conversations appear here</h2>
                <p>Choose a conversation or contact a provider from a service page.</p>
              </div>
            ) : (
              <>
                <header className="messages-thread-heading">
                  <span className="messages-avatar">{conversation?.otherName?.trim().charAt(0)?.toUpperCase() || activeInboxItem?.otherName?.trim().charAt(0)?.toUpperCase() || '?'}</span>
                  <div><h2>{conversation?.otherName || activeInboxItem?.otherName || 'Conversation'}</h2><p>{conversation?.serviceName || activeInboxItem?.serviceName}</p></div>
                  <div className="messages-thread-actions">
                    <button
                      type="button"
                      className="messages-delete-button"
                      onClick={(e) => confirmDeleteConversation(e, conversation || activeInboxItem)}
                      disabled={!conversation && !activeInboxItem}
                    >
                      <Icon name="trash" size={15} /> Delete chat
                    </button>
                    <button type="button" className="messages-report-button" onClick={() => setReportOpen(true)} disabled={!conversation}>
                      <Icon name="flag" size={15} /> Report {user?.userType === 'provider' ? 'customer' : 'provider'}
                    </button>
                  </div>
                </header>
                <div className="messages-history" aria-live="polite" aria-busy={loadingThread}>
                  {loadingThread && messages.length === 0 ? <div className="spinner" /> : messages.length === 0 ? (
                    <p className="messages-thread-empty-copy">No messages yet. Say hello to get started.</p>
                  ) : messages.map((message) => {
                    const own = message.senderId === user?.id;
                    return (
                      <article key={message.id} className={`message-bubble ${own ? 'own' : 'theirs'}`}>
                        <p>{message.body}</p>
                        <div className="message-bubble-footer">
                          <time>{formatMessageTime(message.createdAt)}</time>
                          {own && (
                            <button
                              type="button"
                              className="message-delete-action"
                              title="Delete message"
                              aria-label="Delete message"
                              disabled={deletingMessageId === message.id}
                              onClick={() => executeDeleteMessage(message.id)}
                            >
                              <Icon name="trash" size={11} />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  <div ref={listEndRef} />
                </div>
                <form className="messages-compose" onSubmit={sendMessage}>
                  <label className="sr-only" htmlFor="message-compose">Write a message</label>
                  <textarea
                    id="message-compose"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder="Write a message…"
                    required
                  />
                  <div className="messages-compose-footer">
                    <span>{draft.length}/2000</span>
                    <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
                      <Icon name="send" size={16} />{sending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
        {reportOpen && <div className="report-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submittingReport) setReportOpen(false); }}>
          <form className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title" onSubmit={submitReport}>
            <div className="report-dialog-heading"><span><Icon name="flag" size={19} /></span><button type="button" aria-label="Close report form" onClick={() => setReportOpen(false)} disabled={submittingReport}>×</button></div>
            <h2 id="report-dialog-title">Report {user?.userType === 'provider' ? 'customer' : 'provider'}</h2>
            <p>Your report will be shared privately with the ServiceHub moderation team and reviewed by an administrator.</p>
            <label htmlFor="report-reason">Reason for reporting</label>
            <select id="report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)} required>
              <option value="">Choose a reason</option>
              {REPORT_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label htmlFor="report-description">What happened?</label>
            <textarea id="report-description" value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} minLength={20} maxLength={2000} rows={5} required placeholder="Describe the behavior or incident. Include relevant details so we can review it." />
            <div className="report-description-count">{reportDescription.trim().length}/2000 (at least 20 characters)</div>
            <div className="report-dialog-actions"><button type="button" className="btn btn-secondary" onClick={() => setReportOpen(false)} disabled={submittingReport}>Cancel</button><button type="submit" className="btn btn-primary" disabled={submittingReport || !reportReason || reportDescription.trim().length < 20}>{submittingReport ? 'Sending…' : 'Submit report'}</button></div>
          </form>
        </div>}
        {conversationToDelete && (
          <div
            className="report-dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !deletingChat) setConversationToDelete(null);
            }}
          >
            <div className="report-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-chat-dialog-title">
              <div className="report-dialog-heading">
                <span className="delete-dialog-icon"><Icon name="trash" size={19} /></span>
                <button
                  type="button"
                  aria-label="Close dialog"
                  onClick={() => setConversationToDelete(null)}
                  disabled={deletingChat}
                >
                  ×
                </button>
              </div>
              <h2 id="delete-chat-dialog-title">Delete chat</h2>
              <p>
                Are you sure you want to delete this chat with <strong>{conversationToDelete.otherName}</strong>? All messages in this conversation will be permanently removed.
              </p>
              <div className="report-dialog-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConversationToDelete(null)}
                  disabled={deletingChat}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary delete-confirm-btn"
                  onClick={executeDeleteConversation}
                  disabled={deletingChat}
                >
                  {deletingChat ? 'Deleting…' : 'Delete chat'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
