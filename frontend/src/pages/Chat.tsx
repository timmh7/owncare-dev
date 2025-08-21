import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AuthGuard } from '@/components/AuthGuard';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Bot, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const Chat = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your OwnCare assistant. I can help you understand your insurance plan, find providers, check coverage, and answer questions about your benefits. What would you like to know?",
      sender: 'bot',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userSOB, setUserSOB] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Scroll to bottom whenever messages change
    scrollToBottom();

    // Fetch user SOB only if user exists and SOB hasn't been fetched yet
    if (user && userSOB === null) {
      const loadUserSOB = async () => {
        try {
          const sobUrl = await fetchUserSOB(user.id);
          setUserSOB(sobUrl);
        } catch (error) {
          console.error('Error fetching user SOB:', error);
          setUserSOB(null);
        }
      };
      loadUserSOB();
    }
  }, [user, messages]);


  const fetchUserSOB = async (userId: string) => {
    const { data: planData, error: planError } = await supabase
      .from("user_insurance")
      .select(`insurance_plans(sob_url)`)
      .eq("user_id", userId)
      .single();

    if (planError) throw planError;

    const sobUrl = (planData?.insurance_plans as any)?.sob_url;
    if (!sobUrl) throw new Error("No SOB URL found for user");

    return sobUrl;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentQuery = inputValue;
    setInputValue('');
    setIsTyping(true);

    try {
      // 1. Call semantic search API to find relevant document chunks
      const searchResponse = await fetch(`${API_BASE}/api/semantic-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: currentQuery,
          topK: 10,
          sob_url: userSOB
        }),
      });

      const searchResults = await searchResponse.json();

      let botResponseContent = '';

      if (searchResults.chunks && searchResults.chunks.length > 0) {
        // Step 2: Combine chunks into one context string for LLM
        const contextText = searchResults.chunks
          .map((chunk: any, idx: number) => `(${idx + 1}) ${chunk.content}`)
          .join('\n\n');

        // Step 3: Call LLM API with query + context
        const llmResponse = await fetch(`${API_BASE}/api/RAGresponse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contextText, userQuestion: currentQuery })
        });

        const llmData = await llmResponse.json();
        botResponseContent = llmData.choices[0].message.content;
      } 

      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: botResponseContent,
        sender: 'bot',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Error calling semantic search:', error);

      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble accessing your plan information right now."
        + "Please try again in a moment, or contact your insurance company directly for immediate assistance.",
        sender: 'bot',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickQuestions = [
    "What services are covered under my plan?",
    "What prescription drugs are covered?",
    "What's my copay for specialist visits?",
    "Is dental/vision included in my plan?",
  ];

  const handleQuickQuestion = (question: string) => {
    setInputValue(question);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex flex-col">
        {/* Header */}
        <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-10 h-10 flex items-center justify-center">
                <img src="/owncare-logo.png" alt="OwnCare Logo" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">OwnCare Assistant</h1>
                <p className="text-sm text-muted-foreground">Your healthcare plan advisor</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </header>

        {/* Chat Container */}
        <div className="flex-1 container mx-auto px-4 py-6 flex flex-col max-w-4xl">
          {/* Messages */}
          <Card className="flex-1 shadow-[var(--shadow-card)] border-0 bg-gradient-to-br from-card to-card/50 mb-4">
            <CardContent className="p-6 h-full flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 space-y-2 ${
                        message.sender === 'user'
                          ? 'bg-primary text-primary-foreground ml-4'
                          : 'bg-secondary text-secondary-foreground mr-4'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {message.sender === 'bot' ? (
                          <Bot className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">
                          {message.sender === 'bot' ? 'OwnCare Assistant' : 'You'}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {message.content.split('\n').map((line, index) => {
                          // Handle bold text formatting (both full lines and inline)
                          if (line.startsWith('**') && line.endsWith('**') && !line.includes('**', 2)) {
                            // Full line bold
                            return (
                              <div key={index} className="font-semibold mt-2 mb-1">
                                {line.replace(/\*\*/g, '')}
                              </div>
                            );
                          }
                          
                          // Handle inline bold text and links
                          if (line.includes('**') || line.includes('[')) {
                            let parts: (string | JSX.Element)[] = [];
                            let remaining = line;
                            let partKey = 0;
                            
                            while (remaining.length > 0) {
                              // Check for markdown links first: [text](url)
                              const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
                              if (linkMatch) {
                                const beforeLink = remaining.substring(0, linkMatch.index);
                                const linkText = linkMatch[1];
                                const linkUrl = linkMatch[2];
                                
                                // Add text before link (handle bold formatting in it)
                                if (beforeLink) {
                                  if (beforeLink.includes('**')) {
                                    const boldParts = beforeLink.split(/(\*\*.*?\*\*)/g);
                                    boldParts.forEach(part => {
                                      if (part.startsWith('**') && part.endsWith('**')) {
                                        parts.push(<strong key={partKey++}>{part.replace(/\*\*/g, '')}</strong>);
                                      } else if (part) {
                                        parts.push(part);
                                      }
                                    });
                                  } else {
                                    parts.push(beforeLink);
                                  }
                                }
                                
                                // Add clickable link
                                parts.push(
                                  <a 
                                    key={partKey++} 
                                    href={linkUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 underline"
                                  >
                                    {linkText}
                                  </a>
                                );
                                
                                remaining = remaining.substring(linkMatch.index! + linkMatch[0].length);
                              } else {
                                // Check for bold text: **text**
                                const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
                                if (boldMatch) {
                                  const beforeBold = remaining.substring(0, boldMatch.index);
                                  const boldText = boldMatch[1];
                                  
                                  // Add text before bold
                                  if (beforeBold) {
                                    parts.push(beforeBold);
                                  }
                                  
                                  // Add bold text
                                  parts.push(<strong key={partKey++}>{boldText}</strong>);
                                  
                                  remaining = remaining.substring(boldMatch.index! + boldMatch[0].length);
                                } else {
                                  // No more special formatting, add remaining text
                                  parts.push(remaining);
                                  remaining = '';
                                }
                              }
                            }
                            
                            return (
                              <div key={index} className={line.startsWith('•') ? "ml-4 mb-1" : "mb-1"}>
                                {parts}
                              </div>
                            );
                          }
                          
                          // Handle bullet points
                          if (line.startsWith('•')) {
                            return (
                              <div key={index} className="ml-4 mb-1">
                                {line}
                              </div>
                            );
                          }
                          // Regular lines
                          return line ? (
                            <div key={index} className="mb-1">
                              {line}
                            </div>
                          ) : (
                            <div key={index} className="mb-2"></div>
                          );
                        })}
                      </div>
                      <p className="text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-secondary text-secondary-foreground rounded-lg p-4 mr-4">
                      <div className="flex items-center space-x-2">
                        <Bot className="w-4 h-4" />
                        <span className="text-sm font-medium">OwnCare Assistant</span>
                      </div>
                      <div className="flex space-x-1 mt-2">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Questions */}
              {messages.length === 1 && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-3">Quick questions to get started:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {quickQuestions.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickQuestion(question)}
                        className="text-left justify-start h-auto p-3 text-sm"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="flex space-x-2">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about your healthcare plan..."
                  className="flex-1"
                  disabled={isTyping}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isTyping}
                  variant="healthcare"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
};

export default Chat;