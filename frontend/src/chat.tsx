import { useState, useRef, useEffect } from 'react';
// import { HiOutlineLightBulb, HiOutlineSparkles } from 'react-icons/hi';

export default function Chat() {
  const [messages, setMessages] = useState<Array<{id: string, role: string, content: string, devLog?: string | null}>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDevLog, setShowDevLog] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);
  
  // Generate a consistent thread ID for this session
  const [threadId] = useState(() => {
    const key = 'flicky-thread-id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'thread-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(key, id);
    }
    return id;
  });

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = { id: Date.now().toString(), role: 'user', content: input, devLog: null };
    setMessages(prev => [...prev, userMessage]); // Add to the user messages array to display in the UI
    setInput('');
    setIsLoading(true);

    // Send the message to the agent by making a POST request to the API and cleaning the response text
    try {
      // Send only the current message with user ID - let the agent's memory handle the context
      const res = await fetch(`http://localhost:4111/api/agents/flicky/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [{ role: 'user', content: input }],
          threadId: threadId,
          resourceId: `flicky-chat-session`
        }),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      // Get the reader and decoder for the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let responseText = '';
      
      // Handle streaming response for Mastra format
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          console.log('Raw chunk:', chunk);
          
          // Parse the streaming format: 0:"text content" or 3:"error content"
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('0:"')) {
              // Extract text content from format: 0:"text"
              const text = line.slice(3, -1); // Remove '0:"' and '"'
              responseText += text;
            } else if (line.startsWith('3:"')) {
              // Extract error content from format: 3:"error"
              const errorText = line.slice(3, -1); // Remove '3:"' and '"'
              responseText += errorText;
            }
          }
        }
      }
      
      // Clean up the response text
      const cleanResponse = responseText
        .replace(/\\n/g, '\n')  // Convert literal \n to actual newlines
        .replace(/\\"/g, '"')   // Convert literal \" to actual quotes
        .trim();
      
      console.log('Raw response:', responseText);
      console.log('Clean response:', cleanResponse);
      
      // Check if the response contains rate limit error and throw it as an exception
      const isRateLimitError = cleanResponse.includes('Rate limit reached') || cleanResponse.includes('rate limit');
      
      if (isRateLimitError) {
        // Throw the rate limit error so it goes to the catch block
        throw new Error(cleanResponse);
      }
      
      // Add the bot message to the messages array
      const botMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: cleanResponse || "Sorry, I am busy watching a movie right now. Please try again later.",
        devLog: `Raw response: ${responseText}`
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorDetails = error instanceof Error ? error.message : 'Unknown error occurred';
      
      let errorMessage;
      if (errorDetails.includes('rate limit') || errorDetails.includes('quota') || errorDetails.includes('limit')) {
        errorMessage = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: `Sorry, I am busy watching a movie right now. Please try again later.`,
          devLog: `Exceeded OpenAI API usage quota`
        };
      } else if (errorDetails.includes('Failed to fetch') || errorDetails.includes('Connection refused')) {
        errorMessage = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: `Can't connect to my brain right now! Make sure the Mastra server is running on port 4111.`,
          devLog: `Connection Error ${errorDetails}`
        };
      } else {
        errorMessage = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: `Something went wrong: ${errorDetails}`,
          devLog: `Error Details: ${errorDetails}\n\nCheck the browser console for more information.`
        };
      }
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const resetUser = () => {
    localStorage.removeItem(`flicky-thread-id`);
    setMessages([]);
    window.location.reload(); // Reload to get new thread ID
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="border border-gray-300 rounded-lg">
        {/* Dev Log Toggle */}
        <div className="p-2 border-b border-gray-300">
          <button 
            onClick={() => setShowDevLog(!showDevLog)}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
          >
            {showDevLog ? 'Hide Dev Log' : 'Show Dev Log'}
          </button>
        </div>
        {/* Messages Area */}
        <div className="h-96 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 && (
            <div className="text-center text-gray-600 py-8">
              <p>Hi! I'm Flicky, your movie recommendation assistant.</p>
              <p className="text-sm mt-2">Ask me for movie recommendations!</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-black'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                {showDevLog && message.devLog && (
                  <div className="mt-2 pt-2 border-t border-gray-400 text-xs text-gray-600">
                    <div className="font-semibold">[DEV LOG]</div>
                    <div className="whitespace-pre-wrap">{message.devLog}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 px-3 py-2 rounded">
                <span className="text-sm">...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-300">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask Flicky for movie recommendations..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-center space-x-4 mt-2">
            <button
              onClick={clearChat}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
            >
              Clear Chat
            </button>
            <button
              onClick={resetUser}
              className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
            >
              Reset Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}