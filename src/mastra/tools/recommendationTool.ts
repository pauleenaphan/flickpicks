import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { config } from "dotenv"
import path from "path"

import { genreId } from "../utils/genreId"
import { moviesSeen } from "../moviesSeen"

// Load environment variables from project root
config({ path: path.resolve(process.cwd(), '.env') })

// This tool is used to get movie recommendations BASED on the user's library
export const recommendationTool = createTool({
  id: 'get-personalized-recommendations',
  description: 'Get personalized movie recommendations based on user\'s viewing history',
  inputSchema: z.object({
    amount: z.number().describe('Number of movies to return (default: 5)').optional(),
  }),
  outputSchema: z.object({
    movies: z.array(z.object({
      movie: z.string().describe('The movie title'),
      genre: z.string().describe('The movie genre'),
      plot: z.string().describe('The plot of the movie'),
      releaseYear: z.string().describe('The release year of the movie'),
      vote_average: z.number().describe('The vote average of the movie'),
      recommendation_reason: z.string().describe('Why this movie was recommended')
    }))
  }),
  execute: async ({ context }) => {
    return await getPersonalizedRecommendations(context.amount);
  },
})

// Main function to get personalized recommendations
const getPersonalizedRecommendations = async (amount?: number) => {
  console.log('🎬 RECOMMENDATION TOOL STARTED (SIMPLIFIED VERSION) - amount:', amount);
  console.log('🎬 Movies seen count:', moviesSeen.length);
  
  if (!process.env.TMDB_API_KEY) {
    console.log('🎬 ERROR: TMDB_API_KEY not set');
    throw new Error('TMDB_API_KEY not set');
  }

  if (moviesSeen.length === 0) {
    console.log('🎬 No movies seen, using fallback recommendations');
    // If no movies seen, return popular movies
    return await getFallbackRecommendations(amount || 5);
  }

  const userPreferences = analyzeUserPreferences();
  console.log('🎬 User Preferences:', userPreferences);

  // Get similar movies based on favorite genre
  console.log('🎬 About to call getSimilarMovies...');
  const similarMovies = await getSimilarMovies(userPreferences, amount || 5);
  console.log('🎬 Similar movies found:', similarMovies.length);

  // Remove seen movies
  const unseenMovies = similarMovies.filter(movie => !checkIfMovieHasBeenSeen(movie));
  console.log('🎬 Unseen movies:', unseenMovies.length);

  // If no unseen movies, return some similar movies anyway (temporarily for debugging)
  if (unseenMovies.length === 0 && similarMovies.length > 0) {
    console.log('🎬 No unseen movies, returning first few similar movies for debugging');
    return { movies: similarMovies.slice(0, amount || 5) };
  }

  return { movies: unseenMovies };
}

// Analyze user's viewing preferences
const analyzeUserPreferences = () => {
  const genreCount: Record<string, number> = {};

  moviesSeen.forEach((movie: any) => {
    // Count genres
    if (movie.genre) {
      const genres = movie.genre.split(', ').map((g: string) => g.trim());
      genres.forEach((genre: string) => {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
    }
  });

  // Find most watched genre
  const favoriteGenre = Object.keys(genreCount).reduce((a, b) => 
    genreCount[a] > genreCount[b] ? a : b, Object.keys(genreCount)[0]);

  return {
    favoriteGenre,
    totalMoviesSeen: moviesSeen.length,
    genreDistribution: genreCount
  };
}

// Get movies similar to user's preferences
const getSimilarMovies = async (preferences: any, amount: number) => {
  const params = new URLSearchParams();
  console.log('🎬 Preferences:', preferences);
  
  // Use favorite genre
  if (preferences.favoriteGenre) {
    const genreKey = preferences.favoriteGenre.charAt(0).toUpperCase() + preferences.favoriteGenre.slice(1).toLowerCase();
    const genreIdValue = genreId[genreKey as keyof typeof genreId];
    console.log('🎬 Genre mapping:', { favoriteGenre: preferences.favoriteGenre, genreKey, genreIdValue });
    if (genreIdValue) {
      params.append('with_genres', genreIdValue.toString());
    }
  }

  // Filter for good ratings and released movies
  params.append('vote_average.gte', '6.0');
  params.append('sort_by', 'popularity.desc');
  params.append('page', '1');
  
  // Only get released movies
  const today = new Date().toISOString().split('T')[0];
  params.append('primary_release_date.lte', today);

  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&${params.toString()}`;
  console.log('🎬 Similar movies API call:', url);
  const response = await fetch(url);
  const data = await response.json();
  console.log('🎬 Similar movies response:', data.results?.length || 0, 'movies found');

  return formatRecommendationResults(data.results, amount, `Similar to your favorite genre: ${preferences.favoriteGenre}`);
}

// Fallback for users with no viewing history
const getFallbackRecommendations = async (amount: number) => {
  const params = new URLSearchParams();
  params.append('sort_by', 'popularity.desc');
  params.append('vote_average.gte', '7.0');
  params.append('page', '1');
  
  // Only get released movies
  const today = new Date().toISOString().split('T')[0];
  params.append('primary_release_date.lte', today);

  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();

  return { movies: formatRecommendationResults(data.results, amount, 'Popular movies to get you started') };
}

// Check if movie has been seen
const checkIfMovieHasBeenSeen = (movie: any) => {
  return moviesSeen.some((seenMovie: any) => seenMovie.title === movie.title);
}

// Format recommendation results
const formatRecommendationResults = (results: any[], amount: number, reason: string) => {
  const shuffledResults = results?.sort(() => Math.random() - 0.5) || [];
  return shuffledResults.slice(0, amount).map((movie: any) => ({
    movie: movie.title,
    genre: movie.genre_ids?.map((id: number) => 
      Object.keys(genreId).find(key => genreId[key as keyof typeof genreId] === id)
    ).filter(Boolean).join(', ') || 'Unknown',
    plot: movie.overview || 'No description available',
    releaseYear: movie.release_date?.split('-')[0] || 'Unknown',
    vote_average: movie.vote_average || 0,
    recommendation_reason: reason
  }));
}