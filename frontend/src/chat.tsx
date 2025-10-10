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
    const apiUrl = import.meta.env.VITE_MASTRA_API_URL || 'http://localhost:4111';
    
    try {
      // Send only the current message with user ID - let the agent's memory handle the context
      const res = await fetch(`${apiUrl}/api/agents/flicky/stream`, {
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
      
      console.log('🔍 FLICKY DEBUG - Raw response:', responseText);
      console.log('🔍 FLICKY DEBUG - Clean response:', cleanResponse);
      console.log('🔍 FLICKY DEBUG - Contains READ_LIBRARY_FROM_LOCALSTORAGE:', cleanResponse.includes('READ_LIBRARY_FROM_LOCALSTORAGE'));
      console.log('🔍 FLICKY DEBUG - Contains viewLibraryTool:', cleanResponse.includes('viewLibraryTool'));
      
      // Check if the response contains rate limit error and throw it as an exception
      const isRateLimitError = cleanResponse.includes('Rate limit reached') || cleanResponse.includes('rate limit');
      
      if (isRateLimitError) {
        // Throw the rate limit error so it goes to the catch block
        throw new Error(cleanResponse);
      }

      // Handle Flicky's localStorage instructions
      handleFlickyInstruction(cleanResponse);
      
      // Check if this is an internal command that shouldn't be displayed
      const isInternalCommand = cleanResponse.includes('READ_LIBRARY_FROM_LOCALSTORAGE') || 
                                cleanResponse.includes('ADD_MOVIE_TO_LOCALSTORAGE') || 
                                cleanResponse.includes('REMOVE_MOVIE_FROM_LOCALSTORAGE') ||
                                cleanResponse.includes('GET_PERSONALIZED_RECOMMENDATIONS');
      
      // Only add the message if it's not an internal command
      if (!isInternalCommand) {
        const botMessage = { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: cleanResponse || "Sorry, I am busy watching a movie right now. Please try again later.",
          devLog: `Raw response: ${responseText}`
        };
        setMessages(prev => [...prev, botMessage]);
      }
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

  // Handle Flicky's localStorage instructions
  const handleFlickyInstruction = (response: string) => {
    console.log('🔍 FLICKY DEBUG - handleFlickyInstruction called with response:', response);
    try {
      // Look for instruction patterns in the response
      if (response.includes('ADD_MOVIE_TO_LOCALSTORAGE')) {
        console.log('🔍 FLICKY DEBUG - ADD_MOVIE_TO_LOCALSTORAGE instruction detected!');
        
        // Try to extract movie data from the response
        // Look for JSON-like structure in the response
        const jsonMatch = response.match(/\{[^}]*"movie"[^}]*\}/);
        if (jsonMatch) {
          try {
            const movieData = JSON.parse(jsonMatch[0]);
            console.log('🔍 FLICKY DEBUG - Extracted movie data:', movieData);
            addMovieToLibrary(movieData);
          } catch (parseError) {
            console.error('🔍 FLICKY DEBUG - Failed to parse movie data:', parseError);
          }
        } else {
          console.log('🔍 FLICKY DEBUG - No JSON movie data found in response');
        }
      }
      
      if (response.includes('REMOVE_MOVIE_FROM_LOCALSTORAGE')) {
        console.log('Flicky wants to remove a movie from localStorage');
        
        // Try to extract movie title from the response
        const titleMatch = response.match(/"([^"]+)"/);
        if (titleMatch) {
          const title = titleMatch[1];
          removeMovieFromLibrary(title);
        }
      }
      
      if (response.includes('READ_LIBRARY_FROM_LOCALSTORAGE')) {
        // Flicky wants to read the library
        console.log('🔍 FLICKY DEBUG - READ_LIBRARY_FROM_LOCALSTORAGE instruction detected!');
        const library = JSON.parse(localStorage.getItem('userLibrary') || '[]');
        console.log('🔍 FLICKY DEBUG - Library from localStorage:', library);
        console.log('🔍 FLICKY DEBUG - Library length:', library.length);
        
        // Send the library data back to Flicky as a follow-up message
        if (library.length > 0) {
          const libraryText = library.map((movie: any) => 
            `${movie.movie} (${movie.releaseYear}) - ${movie.vote_average}/10`
          ).join('\n');
          
          // Automatically send library data to Flicky
          setTimeout(async () => {
            console.log('🔍 FLICKY DEBUG - Sending library data to Flicky:', libraryText);
            const apiUrl = import.meta.env.VITE_MASTRA_API_URL || 'http://localhost:4111';
            try {
              const libraryResponse = await fetch(`${apiUrl}/api/agents/flicky/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  messages: [{ role: 'user', content: `Here's my current library:\n${libraryText}` }],
                  threadId: threadId,
                  resourceId: `flicky-chat-session`
                }),
              });
              
              console.log('🔍 FLICKY DEBUG - Library API response status:', libraryResponse.status);
              if (libraryResponse.ok) {
                console.log('🔍 FLICKY DEBUG - Library API call successful, processing response...');
                const reader = libraryResponse.body?.getReader();
                const decoder = new TextDecoder();
                let responseText = '';
                
                if (reader) {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                      if (line.startsWith('0:"')) {
                        const text = line.slice(3, -1);
                        responseText += text;
                      } else if (line.startsWith('3:"')) {
                        const errorText = line.slice(3, -1);
                        responseText += errorText;
                      }
                    }
                  }
                }
                
                const cleanResponse = responseText
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"')
                  .trim();
                
                console.log('🔍 FLICKY DEBUG - Library response from Flicky:', cleanResponse);
                
                const libraryMessage = {
                  id: (Date.now() + 2).toString(),
                  role: 'assistant',
                  content: cleanResponse || `Here's your current library:\n${libraryText}`,
                  devLog: 'Library data sent to Flicky'
                };
                setMessages(prev => [...prev, libraryMessage]);
              }
            } catch (error) {
              console.error('🔍 FLICKY DEBUG - Error sending library to Flicky:', error);
              // Fallback to just showing the library
              const libraryMessage = {
                id: (Date.now() + 2).toString(),
                role: 'assistant',
                content: `Here's your current library:\n${libraryText}`,
                devLog: 'Library data shown (Flicky unavailable)'
              };
              setMessages(prev => [...prev, libraryMessage]);
            }
          }, 100);
        } else {
          // No movies in library
          const emptyMessage = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: "You don't have any movies in your library yet. Try adding some movies first!",
            devLog: 'Empty library detected'
          };
          setMessages(prev => [...prev, emptyMessage]);
        }
      }

      if (response.includes('GET_PERSONALIZED_RECOMMENDATIONS')) {
        // Flicky wants to get personalized recommendations
        const library = JSON.parse(localStorage.getItem('userLibrary') || '[]');
        console.log('Flicky wants personalized recommendations based on library:', library);
        
        // Send a message with library data for recommendations
        if (library.length > 0) {
          const libraryMessage = {
            id: (Date.now() + 5).toString(),
            role: 'assistant',
            content: `I'll analyze your library of ${library.length} movies to give you personalized recommendations.`,
            devLog: 'Library data provided for personalized recommendations'
          };
          setMessages(prev => [...prev, libraryMessage]);
        }
      }
    } catch (error) {
      console.error('Error handling Flicky instruction:', error);
    }
  };

  // Helper function to add movie to localStorage (similar to library.tsx)
  const addMovieToLibrary = (movieData: any) => {
    try {
      const existingLibrary = JSON.parse(localStorage.getItem('userLibrary') || '[]');
      
      // Check if movie already exists
      const movieExists = existingLibrary.some((m: any) => m.movie === movieData.movie);
      
      if (movieExists) {
        console.log('Movie already in library');
        return;
      }
      
      // Add movie to library
      const updatedLibrary = [...existingLibrary, movieData];
      localStorage.setItem('userLibrary', JSON.stringify(updatedLibrary));
      
      console.log('Successfully added to library via Flicky:', movieData.movie);
      
      // Show success message to user
      const successMessage = {
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: `✅ Added "${movieData.movie}" to your library!`,
        devLog: 'Movie added to library'
      };
      setMessages(prev => [...prev, successMessage]);
      
    } catch (error) {
      console.error('Failed to add movie to library:', error);
    }
  };

  // Helper function to remove movie from localStorage
  const removeMovieFromLibrary = (title: string) => {
    try {
      const existingLibrary = JSON.parse(localStorage.getItem('userLibrary') || '[]');
      
      // Find and remove the movie
      const updatedLibrary = existingLibrary.filter((m: any) => m.movie !== title);
      
      if (updatedLibrary.length === existingLibrary.length) {
        console.log('Movie not found in library');
        return;
      }
      
      localStorage.setItem('userLibrary', JSON.stringify(updatedLibrary));
      
      console.log('Successfully removed from library via Flicky:', title);
      
      // Show success message to user
      const successMessage = {
        id: (Date.now() + 4).toString(),
        role: 'assistant',
        content: `✅ Removed "${title}" from your library!`,
        devLog: 'Movie removed from library'
      };
      setMessages(prev => [...prev, successMessage]);
      
    } catch (error) {
      console.error('Failed to remove movie from library:', error);
    }
  };

  return (
    <div className="md:w-1/2 h-full w-full">
      <div className="border border-gray-600 rounded-lg h-full flex flex-col bg-gray-800">
        {/* Dev Log Toggle */}
        <div className="p-2 border-b border-gray-600 flex-shrink-0">
          <button 
            onClick={() => setShowDevLog(!showDevLog)}
            className="px-3 py-1 text-sm border border-gray-600 rounded hover:bg-gray-700 text-white bg-gray-800"
          >
            {showDevLog ? 'Hide Dev Log' : 'Show Dev Log'}
          </button>
        </div>
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p>Hi! I'm Flicky, your movie recommendation assistant.</p>
              <p className="text-base mt-2">Ask me for movie recommendations!</p>
            </div>
          )}
          
          {messages.map((message) => {
            const timestamp = new Date(parseInt(message.id)).toLocaleTimeString([], { 
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
            
            return (
              <div key={message.id} className="mb-4">
                {/* Sender label and timestamp */}
                <div className={`flex items-center mb-1 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-xs text-gray-400 font-medium mb-2">
                    {message.role === 'user' ? 'You' : 'Flicky'} • {timestamp}
                  </span>
                </div>
                
                {/* Message bubble */}
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`w-fit max-w-2xl px-3 py-2 rounded ${
                      message.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-none text-base'
                        : 'bg-gray-200 text-black rounded-bl-none text-base'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div dangerouslySetInnerHTML={{ 
                        __html: message.content
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br>')
                      }} />
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                    {showDevLog && message.devLog && (
                      <div className="mt-2 pt-2 border-t border-gray-400 text-xs text-gray-600">
                        <div className="font-semibold">[DEV LOG]</div>
                        <div className="whitespace-pre-wrap">{message.devLog}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 px-3 py-2 rounded">
                <span className="text-base text-white">
                  Flicky is typing
                  <span className="inline-block animate-pulse">...</span>
                </span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-600 flex-shrink-0">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask Flicky for movie recommendations..."
              className="flex-1 px-3 py-2 border border-gray-600 rounded focus:outline-none focus:border-purple-500 bg-gray-700 text-white placeholder-gray-400"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-purple-900 border-2 border-purple-700  text-white rounded-lg hover:bg-purple-600 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}