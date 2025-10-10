import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), '.env') });

// Search for a movie and return exact match or suggestions
export const searchForMovie = async (title: string) => {
  try {
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.results?.length) return { found: false };
    
    // Check for exact match
    const exactMatch = data.results.find((movie: any) => 
      movie.title.toLowerCase() === title.toLowerCase()
    );
    
    if (exactMatch) return { found: true, movieData: exactMatch };
    
    // Return suggestions
    return { 
      found: false, 
      suggestions: data.results.slice(0, 3).map((movie: any) => movie.title) 
    };
  } catch {
    return { found: false };
  }
};

// Search for keywords and return their IDs
// Keywords only takes in IDs and not actual keywords
export const searchForKeywords = async (keyword: string) => {
  try {
    const url = `https://api.themoviedb.org/3/search/keyword?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(keyword)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.results?.length) return [];
    
    // Return keyword IDs
    return data.results.map((kw: any) => kw.id.toString());
  } catch {
    return [];
  }
};

// Get movies with flexible filter options
export const getMovies = async (options: {
  withGenres?: string;
  keywords?: string;
  voteMin?: string;
  voteMax?: string;
  sortBy?: string;
  page?: string;
  excludeReleased?: boolean;
  randomRating?: boolean;
}) => {
  // If keywords are provided, use regular movie search (searches titles + plots)
  if (options.keywords && !options.withGenres) {
    return await getMoviesWithSearch(options);
  }

  // Regular discover with genres and other filters
  const params = new URLSearchParams({
    sort_by: options.sortBy || 'popularity.desc',
    page: options.page || '1'
  });

  // Add genre filter if provided
  if (options.withGenres) {
    params.append('with_genres', options.withGenres);
  }

  // Add keyword search if provided - first get keyword IDs
  if (options.keywords) {
    const keywordIds = await searchForKeywords(options.keywords);
    if (keywordIds.length > 0) {
      params.append('with_keywords', keywordIds.join(','));
    }
  }

  // Only add rating filters if user specified them, otherwise get random ratings
  if (options.voteMin && !options.randomRating) {
    params.append('vote_average.gte', options.voteMin);
  }
  
  if (options.voteMax && !options.randomRating) {
    params.append('vote_average.lte', options.voteMax);
  }

  // If random rating, get a wide range to ensure variety
  if (options.randomRating) {
    params.append('vote_average.gte', '1.0');
    params.append('vote_average.lte', '10.0');
  }

  if (options.excludeReleased) {
    const today = new Date().toISOString().split('T')[0];
    params.append('primary_release_date.lte', today);
  }

  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&${params.toString()}`;
  const response = await fetch(url);
  return response.json();
};

// Helper function for regular movie search (searches titles + plots)
const getMoviesWithSearch = async (options: any) => {
  const params = new URLSearchParams({
    query: options.keywords,
    page: options.page || '1',
    sort_by: options.sortBy || 'popularity.desc'
  });

  const url = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();
  
  // Filter out unreleased movies if requested
  if (options.excludeReleased && data.results) {
    const today = new Date().toISOString().split('T')[0];
    data.results = data.results.filter((movie: any) => 
      movie.release_date && movie.release_date <= today
    );
  }
  
  return data;
};
