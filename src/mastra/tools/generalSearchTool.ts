import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { genreId } from "../utils/genreId"
import { getMovies } from "../api/tmdb/utils"
import { getLibraryFromMemory } from "./libraryTool"

// Gets movies from the TMBD API based on the user's request
export const movieTool = createTool({
  id: 'get-movie',
  description: 'Get movies from the TMBD API',
  inputSchema: z.object({
    genre: z.string().describe('The genre to get').optional(),
    keywords: z.string().describe('Keywords to search for (e.g., "animals", "friendship", "space")').optional(),
    amount: z.number().describe('Number of movies to return (default: 5)').optional(),
    sort: z.string().describe('How to sort results').optional(),
    minRating: z.number().describe('Minimum rating (1-10)').optional(),
    maxRating: z.number().describe('Maximum rating (1-10)').optional(),
  }),
  outputSchema: z.object({
    movies: z.array(z.object({
      movie: z.string().describe('The movie title'),
      genre: z.string().describe('The movie genre'),
      plot: z.string().describe('The plot of the movie'),
      releaseYear: z.string().describe('The release year of the movie'),
      vote_average: z.number().describe('The vote average of the movie'),
    }))
  }),
  execute: async ({ context }) => {
    return await getMovie(context, context.genre, context.keywords, context.amount, context.sort, context.minRating, context.maxRating);
  },
})

const getMovie = async (context: any, genre?: string, keywords?: string, amount?: number, sort?: string, minRating?: number, maxRating?: number) => {
  // Determine if user wants specific ratings or random
  const hasSpecificRating = minRating !== undefined || maxRating !== undefined;
  
  // Get genre ID if genre is specified
  let genreIdValue = '';
  if (genre) {
    const genreKey = genre.charAt(0).toUpperCase() + genre.slice(1).toLowerCase();
    genreIdValue = genreId[genreKey as keyof typeof genreId]?.toString() || '';
  }
  
  const data = await getMovies({
    withGenres: genreIdValue,
    keywords: keywords,
    voteMin: minRating?.toString(),
    voteMax: maxRating?.toString(),
    sortBy: sort || 'popularity.desc',
    page: '1',
    excludeReleased: true,
    randomRating: !hasSpecificRating
  });
  
  // Get user's library to filter out seen movies
  const moviesSeen = await getLibraryFromMemory(context);
  const unseenMovies = data.results?.filter((movie: any) => !checkIfMovieHasBeenSeen(movie, moviesSeen)) || [];
  
  return formatMovieResults(unseenMovies, amount);
}

const checkIfMovieHasBeenSeen = (movie: any, moviesSeen: any[]) => {
  return moviesSeen.some((seenMovie: any) => seenMovie.movie === movie.title);
}

const formatMovieResults = (results: any[], amount?: number) => {
  const shuffledResults = results?.sort(() => Math.random() - 0.5) || [];
  const movies = shuffledResults.slice(0, amount || 5).map((movie: any) => ({
    movie: movie.title,
    genre: movie.genre_ids?.map((id: number) => 
      Object.keys(genreId).find(key => genreId[key as keyof typeof genreId] === id)
    ).filter(Boolean).join(', ') || 'Unknown',
    plot: movie.overview || 'No description available',
    releaseYear: movie.release_date?.split('-')[0] || 'Unknown',
    vote_average: movie.vote_average || 0
  }));
  
  return { movies };
}