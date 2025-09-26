import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { config } from "dotenv"
import path from "path"

import { genreId } from "../utils/genreId"

// Load environment variables from project root
config({ path: path.resolve(process.cwd(), '.env') })

interface Movie {
  movie: string;
  genre: string;
  plot: string;
  releaseYear: string;
}

export const movieTool = createTool({
  id: 'get-movie',
  description: 'Get 5 movies from the TMBD API',
  inputSchema: z.object({
    genre: z.string().describe('The genre to get, get the genre id from the genreId object').optional(),
    mood: z.string().describe('The mood to get').optional(),
    decade: z.string().describe('The decade to get').optional(),
  }),
  outputSchema: z.object({
    movies: z.array(z.object({
      movie: z.string().describe('The movie title'),
      genre: z.string().describe('The movie genre'),
      plot: z.string().describe('The plot of the movie'),
      releaseYear: z.string().describe('The release year of the movie'),
    }))
  }),
  execute: async ({ context }) => {
    return await getMovie(context.genre, context.mood, context.decade);
  },
})

// Calls the TMBD API and returns the top 5 movies
const getMovie = async (genre?: string, mood?: string, decade?: string) => {
  console.log('Environment variables:', {
    TMDB_API_KEY: process.env.TMDB_API_KEY ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV
  });
  
  if (!process.env.TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not set');
  }

  const params = new URLSearchParams();
  
  // Convert genre name to ID
  if (genre) {
    const genreKey = genre.charAt(0).toUpperCase() + genre.slice(1).toLowerCase();
    const genreIdValue = genreId[genreKey as keyof typeof genreId];
    if (genreIdValue) params.append('with_genres', genreIdValue.toString());
  }
  
  if (mood) params.append('with_keywords', mood);
  if (decade) {
    // Handle decade format like "1990s" -> 1990-1999
    let startYear: string, endYear: string;
    
    if (decade.includes('s')) {
      // Extract the decade (e.g., "1990s" -> "1990")
      const decadeNum = decade.replace('s', '');
      startYear = decadeNum;
      endYear = (parseInt(decadeNum) + 9).toString();
    } else {
      // Single year provided
      startYear = decade;
      endYear = decade;
    }
    
    params.append('primary_release_date.gte', `${startYear}-01-01`);
    params.append('primary_release_date.lte', `${endYear}-12-31`);
  }
  
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json();
  
  const movies = data.results?.slice(0, 5).map((movie: any) => ({
    movie: movie.title,
    genre: movie.genre_ids?.map((id: number) => 
      Object.keys(genreId).find(key => genreId[key as keyof typeof genreId] === id)
    ).filter(Boolean).join(', ') || 'Unknown',
    plot: movie.overview || 'No description available',
    releaseYear: movie.release_date?.split('-')[0] || 'Unknown'
  })) || [];
  
  return { movies };
}