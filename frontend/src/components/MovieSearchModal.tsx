import { useState, useEffect } from "react";
import { FaStar } from "react-icons/fa";
import * as Dialog from "@radix-ui/react-dialog";
import searchForMovie from "../api/tmdb/search";

interface MovieSearchModalProps {
  onMovieAdded?: () => void;
  currentLibrary?: any[];
}

// Movie search modal for the user to search for movies to add to their library
export const MovieSearchModal = ({ onMovieAdded, currentLibrary = [] }: MovieSearchModalProps) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchCache, setSearchCache] = useState<Record<string, any[]>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [addingMovies, setAddingMovies] = useState<Set<number>>(new Set());

  // Debounced search - only search after user stops typing for 1 second
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        handleSearch();
      } else {
        setSearchResults([]);
        setShowAllResults(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSearch = async () => {
    const trimmedTerm = searchTerm.trim().toLowerCase();

    // Check cache first
    if (searchCache[trimmedTerm]) {
      console.log("Using cached results for:", trimmedTerm);
      setSearchResults(searchCache[trimmedTerm]);
      setShowAllResults(false);
      return;
    }

    setIsSearching(true);
    setShowAllResults(false);
    try {
      console.log("Making API call for:", trimmedTerm);
      const results = await searchForMovie(searchTerm);
      const movieResults = results.results || [];

      // Cache the results
      setSearchCache(prev => ({
        ...prev,
        [trimmedTerm]: movieResults
      }));

      setSearchResults(movieResults);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Helper function to check if movie is already in library
  const isMovieInLibrary = (movie: any) => {
    return currentLibrary.some((libMovie: any) => libMovie.movie === movie.title);
  };

  const handleAddToLibrary = async (movie: any) => {
    // Add movie ID to the adding set
    setAddingMovies(prev => new Set(prev).add(movie.id));

    try {
      console.log('Adding to library:', movie.title);

      // Get existing library from localStorage
      const existingLibrary = JSON.parse(localStorage.getItem('userLibrary') || '[]');

      // Check if movie already exists
      const movieExists = existingLibrary.some((m: any) => m.movie === movie.title);

      if (movieExists) {
        console.log('Movie already in library');
        return;
      }

      // Add movie to library
      const movieToAdd = {
        movie: movie.title,
        genre: movie.genre_ids?.[0]?.toString() || 'Unknown',
        plot: movie.overview || 'No description available',
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear().toString() : 'Unknown',
        vote_average: movie.vote_average || 0
      };

      const updatedLibrary = [...existingLibrary, movieToAdd];
      localStorage.setItem('userLibrary', JSON.stringify(updatedLibrary));

      console.log('Successfully added to library:', movie.title);

      // Call the callback to refresh the parent component
      if (onMovieAdded) {
        onMovieAdded();
      }

    } catch (error) {
      console.error('Failed to add to library:', error);
    } finally {
      // Remove movie ID from the adding set
      setAddingMovies(prev => {
        const newSet = new Set(prev);
        newSet.delete(movie.id);
        return newSet;
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when modal closes
      setSearchTerm("");
      setSearchResults([]);
      setShowAllResults(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="px-4 py-2 bg-purple-900 border-2 border-purple-700  text-white rounded-lg hover:bg-purple-600 transition-colors duration-200 font-medium">
          Add Movies
        </button>
      </Dialog.Trigger>
      
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 h-full w-full" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl w-[900px] h-[600px] z-50 flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-600">
            <Dialog.Title className="text-xl font-semibold text-white">
              Add Movies to Your Library
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-200 transition-colors">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Dialog.Close>
          </div>
          
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Search Input */}
            <div className="p-6 border-b border-gray-600">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for a movie to add to your library..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-5 py-4 pr-14 border border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md bg-gray-700 text-white placeholder-gray-400"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                  {isSearching ? (
                    <svg
                      className="h-5 w-5 text-purple-500 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto p-6">
              {searchResults.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4 text-white">
                    Search Results ({searchResults.length} found)
                  </h3>
                  <div className="space-y-3">
                    {(showAllResults ? searchResults : searchResults.slice(0, 5)).map((movie: any) => (
                      <div key={movie.id} className="group p-5 border border-gray-600 rounded-xl hover:border-purple-500 hover:shadow-lg transition-all duration-300 bg-gray-700">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-bold text-white mb-2 text-lg group-hover:text-purple-400 transition-colors duration-200">
                              {movie.title}
                            </h4>
                            <div className="flex items-center mb-3">
                              <span className="text-sm text-gray-300 font-medium">
                                {movie.release_date ? new Date(movie.release_date).getFullYear() : 'Unknown Year'}
                              </span>
                              {movie.vote_average !== undefined && movie.vote_average !== null && (
                                <span className="ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-700 text-white">
                                  <FaStar size={10} className="mr-1 text-yellow-400" />
                                  {movie.vote_average.toFixed(1)}
                                </span>
                              )}
                            </div>
                            {movie.overview && (
                              <p className="text-base text-gray-400 leading-relaxed">
                                {movie.overview}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleAddToLibrary(movie)}
                            disabled={addingMovies.has(movie.id) || isMovieInLibrary(movie)}
                            className={`ml-6 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 flex-shrink-0 shadow-sm flex items-center gap-2 ${
                              addingMovies.has(movie.id)
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : isMovieInLibrary(movie)
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  : 'bg-purple-900 border-2 border-purple-700 text-white hover:bg-purple-600 transition-colors duration-200'
                            }`}
                          >
                            {addingMovies.has(movie.id) ? (
                              <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Adding...
                              </>
                            ) : isMovieInLibrary(movie) ? (
                              <>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                In Library
                              </>
                            ) : (
                              'Add to Library'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {searchResults.length > 5 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setShowAllResults(!showAllResults)}
                        className="px-6 py-2 bg-purple-900 border-2 border-purple-700 hover:bg-purple-600 text-white rounded-lg transition-colors duration-200 font-medium"
                      >
                        {showAllResults
                          ? `Show Less (showing ${searchResults.length} of ${searchResults.length})`
                          : `Show More (showing 5 of ${searchResults.length})`
                        }
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
