import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Trash2, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { formatDateTimeFr } from '@/lib/datetime';

interface Author {
  id: number;
  name: string;
  email: string;
}

interface Message {
  id: number;
  content: string;
  is_internal: boolean;
  attachments: string[];
  created_at: string;
  author: Author;
}

interface TicketChatProps {
  ticketId: number;
  currentUserId: number;
  isAgent?: boolean;
}

export default function TicketChat({ ticketId, currentUserId, isAgent = false }: TicketChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendingMode, setSendingMode] = useState<'public' | 'internal'>('public');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (force = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 80;
    if (force || isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  };

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`/tickets/${ticketId}/messages`);
      setMessages(response.data.messages);
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error('Erreur lors de la récupération des messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);

    return () => clearInterval(interval);
  }, [ticketId]);

  const sendMessage = async (internal: boolean) => {
    if (!newMessage.trim()) return;

    setSendingMode(internal ? 'internal' : 'public');
    setIsSending(true);
    try {
      const response = await axios.post(`/tickets/${ticketId}/messages`, {
        content: newMessage,
        is_internal: internal,
      });

      setMessages([...messages, response.data.message]);
      setNewMessage('');
      setTimeout(() => scrollToBottom(true), 50);
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      alert('Erreur lors de l\'envoi du message');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(false);
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) return;

    try {
      await axios.delete(`/tickets/${ticketId}/messages/${messageId}`);
      setMessages(messages.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error('Erreur lors de la suppression du message:', error);
      alert('Erreur lors de la suppression du message');
    }
  };

  const visibleMessages = isAgent ? messages : messages.filter((m) => !m.is_internal);

  const formatDate = (dateString: string) => {
    return formatDateTimeFr(dateString, { timeZone: 'Europe/Paris' });
  };

  return (
    <Card>
      <CardHeader className="pb-3 bg-muted/10">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <MessageSquare className="h-4 w-4" />
          Discussion
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Messages Area */}
          <div
            className="h-[34vh] max-h-[22rem] min-h-44 overflow-y-auto rounded-lg border bg-muted/10 p-3 sm:h-96 sm:max-h-[26rem] sm:min-h-52 sm:p-4"
            ref={messagesContainerRef}
          >
            {isLoading && visibleMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Aucun message pour le moment
              </div>
            ) : (
              <div className="space-y-4">
                {visibleMessages.map((message) => {
                  const isCurrentUser = message.author.id === currentUserId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[88%] sm:max-w-[70%] ${isCurrentUser ? 'bg-primary/90 dark:bg-primary/30 text-primary-foreground' : 'bg-muted/80 dark:bg-muted/60'} space-y-2 rounded-lg p-2.5 sm:p-3`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold">
                            {message.author.name}
                          </div>
                          <div className="flex items-center gap-1">
                            {isCurrentUser && (
                              <button
                                onClick={() => handleDeleteMessage(message.id)}
                                className="text-xs opacity-70 hover:opacity-100 p-1"
                                title="Supprimer"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap break-words text-sm">
                          {message.content}
                        </div>
                        <div className={`text-xs ${isCurrentUser ? 'opacity-80' : 'text-muted-foreground'}`}>
                          {formatDate(message.created_at)}
                        </div>
                        {message.is_internal && isAgent && (
                          <Badge variant="secondary" className="text-xs border border-dashed border-[#2a3ff5] bg-[#f3f4f6] text-[#141d3a]">
                            Interne (équipe)
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="space-y-2">
            <Textarea
              value={newMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMessage(e.target.value)}
              placeholder="Tapez votre message..."
              className="resize-none"
              rows={2}
              disabled={isSending}
            />
            <div className="flex flex-wrap justify-end gap-2">
              {isAgent && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSending || !newMessage.trim()}
                  onClick={() => sendMessage(true)}
                >
                  {isSending && sendingMode === 'internal' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Envoi interne...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Envoyer en interne
                    </>
                  )}
                </Button>
              )}
              <Button type="submit" disabled={isSending || !newMessage.trim()}>
                {isSending && sendingMode === 'public' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Envoyer
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
