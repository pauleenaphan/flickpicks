import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { genreId } from "../utils/genreId"
import { getMovies } from "../api/tmdb/utils"
import { getLibraryFromMemory } from "./libraryTool"

// Recommends the user movies based on their library
export const libraryRecTool = createTool({
  id: 'get-personalized-recommendations',
  description: 'Get personalized movie recommendations based on user\'s library',
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
    return await getPersonalizedRecommendations(context, context.amount);
  },
})

const getPersonalizedRecommendations = async (context: any, amount?: number) => {
  const moviesSeen = await getLibraryFromMemory(context);
  
  if (moviesSeen.length === 0) {
    return { movies: [] };
  }

  const userPreferences = analyzeUserPreferences(moviesSeen);
  const similarMovies = await getSimilarMovies(userPreferences, amount || 5);
  const unseenMovies = similarMovies.filter((movie: any) => !checkIfMovieHasBeenSeen(movie, moviesSeen));

  return { movies: unseenMovies.length > 0 ? unseenMovies : similarMovies.slice(0, amount || 5) };
}

const analyzeUserPreferences = (moviesSeen: any[]) => {
  const genreCount: Record<string, number> = {};

  moviesSeen.forEach((movie: any) => {
    if (movie.genre) {
      const genres = movie.genre.split(', ').map((g: string) => g.trim());
      genres.forEach((genre: string) => {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
    }
  });

  const favoriteGenre = Object.keys(genreCount).reduce((a, b) => 
    genreCount[a] > genreCount[b] ? a : b, Object.keys(genreCount)[0]);

  return { favoriteGenre };
}

const getSimilarMovies = async (preferences: any, amount: number) => {
  if (!preferences.favoriteGenre) return [];

  const genreKey = preferences.favoriteGenre.charAt(0).toUpperCase() + preferences.favoriteGenre.slice(1).toLowerCase();
  const genreIdValue = genreId[genreKey as keyof typeof genreId];
  
  if (!genreIdValue) return [];

  const data = await getMovies({
    withGenres: genreIdValue.toString(),
    sortBy: 'popularity.desc',
    page: '1',
    excludeReleased: true,
    randomRating: true
  });

  return formatRecommendationResults(data.results, amount, `Similar to your favorite genre: ${preferences.favoriteGenre}`);
}

const checkIfMovieHasBeenSeen = (movie: any, moviesSeen: any[]) => {
  return moviesSeen.some((seenMovie: any) => seenMovie.movie === movie.title);
}

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