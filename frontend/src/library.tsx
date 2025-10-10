import { useState, useEffect } from "react";
import { FaStar } from "react-icons/fa";
import { MovieSearchModal } from "./components/MovieSearchModal";

export const Library = () => {
  const [userLibrary, setUserLibrary] = useState<any[]>([]);

  // Load user library from localStorage on component mount
  useEffect(() => {
    const library = JSON.parse(localStorage.getItem('userLibrary') || '[]');
    setUserLibrary(library);
  }, []);

  // Function to refresh library when a movie is added via modal
  const handleMovieAdded = () => {
    const library = JSON.parse(localStorage.getItem('userLibrary') || '[]');
    setUserLibrary(library);
  };

  // Function to remove a movie from the library
  const handleRemoveMovie = (movieTitle: string) => {
    const existingLibrary = JSON.parse(localStorage.getItem('userLibrary') || '[]');
    const updatedLibrary = existingLibrary.filter((movie: any) => movie.movie !== movieTitle);
    localStorage.setItem('userLibrary', JSON.stringify(updatedLibrary));
    setUserLibrary(updatedLibrary);
  };

  return (
    <div className="md:w-1/2 h-full flex flex-col text-white ">
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-semibold text-white">Your Library ({userLibrary.length} movies)</h1>
          <MovieSearchModal onMovieAdded={handleMovieAdded} currentLibrary={userLibrary} />
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Add movies to your library to get personalized recommendations.
        </p>
      </div>
      
      <div className="flex-1 overflow-y-auto h-full">
        {userLibrary.length > 0 ? (
          <div className="space-y-4">
            {userLibrary.map((movie: any, index: number) => (
              <div key={index} className="group p-3 border border-gray-600 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors duration-200 relative">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex flex-row items-center gap-4">
                      <h4 className="font-semibold text-white text-lg">{movie.movie}</h4>
                      <p className="text-sm text-gray-300">
                        {movie.releaseYear}
                        {movie.vote_average !== undefined && movie.vote_average !== null && (
                          <span className="ml-2 inline-flex items-center px-2 py-1">
                            <FaStar size={10} className="mr-1 text-yellow-400" />
                            {movie.vote_average.toFixed(1)}
                          </span>
                        )}
                      </p>
                    </div>
                    
                    {movie.plot && (
                      <p className="text-base text-gray-400 mt-1">{movie.plot}</p>
                    )}
                  </div>
                  {/* Remove button - only visible on hover */}
                  <button
                    onClick={() => handleRemoveMovie(movie.movie)}
                    className="opacity-0 group-hover:opacity-100 transition-all duration-200 ml-4 p-2 text-white bg-red-900 border border-red-700 rounded-md hover:bg-red-800 hover:border-red-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center border border-gray-600 rounded-lg bg-gray-700">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-xl font-medium text-white mb-1">No movies in your library yet</h3>
            <p className="text-sm text-gray-400">Click "Add Movies" to search and add movies to your library!</p>
          </div>
        )}
      </div>
    </div>
  );
};