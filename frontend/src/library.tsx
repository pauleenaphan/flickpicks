import { useState, useEffect } from "react";

import searchForMovie from "./api/tmdb/search";

export const Library = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchCache, setSearchCache] = useState<Record<string, any[]>>({});

  // Debounced search - only search after user stops typing for 1 second
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length >= 2) { // Only search if 3+ characters
        handleSearch();
      } else {
        setSearchResults([]); // Clear results if search term is too short
      }
    }, 1000); // Increased to 1 second

    return () => clearTimeout(timeoutId); // Cleanup timeout
  }, [searchTerm]);

  const handleSearch = async () => {
    const trimmedTerm = searchTerm.trim().toLowerCase();
    
    // Check cache first
    if (searchCache[trimmedTerm]) {
      console.log("Using cached results for:", trimmedTerm);
      setSearchResults(searchCache[trimmedTerm]);
      return;
    }

    // Make API call only if not in cache
    console.log("Making API call for:", trimmedTerm);
    const results = await searchForMovie(searchTerm);
    const movieResults = results.results || [];
    
    // Cache the results
    setSearchCache(prev => ({
      ...prev,
      [trimmedTerm]: movieResults
    }));
    
    setSearchResults(movieResults);
  }

  return (
    <div>
      <h1>Your Library</h1>
      <div> 
        <div>
          <input 
            type="text" 
            placeholder="Search for a movie to add to your library" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} />
          <button onClick={() => searchForMovie(searchTerm)}>Add</button>
        </div>
        <div>
          {searchResults.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Search Results:</h3>
              <div className="space-y-2">
                {searchResults.slice(0, 5).map((movie: any) => (
                  <div key={movie.id} className="p-2 border rounded hover:bg-gray-50">
                    <h4 className="font-medium">{movie.title}</h4>
                    <p className="text-sm text-gray-600">{movie.release_date}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <p> display user's movies here</p>
        </div>
      </div>
    </div>
  )
}