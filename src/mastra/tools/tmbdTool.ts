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
    keywords: z.string().describe('Keywords to search for (e.g., "friendship", "betrayal", "uplifting")').optional(),
    decade: z.string().describe('The decade to get').optional(),
    amount: z.number().describe('Number of movies to return (default: 5)').optional(),
    sort: z.string().describe('How to sort results (e.g., "popular", "top rated", "new")').optional(),
  }),
  outputSchema: z.object({
    movies: z.array(z.object({
      movie: z.string().describe('The movie title'),
      genre: z.string().describe('The movie genre'),
      plot: z.string().describe('The plot of the movie'),
      releaseYear: z.string().describe('The release year of the movie'),
      vote_average: z.number().describe('The vote average of the movie')
    }))
  }),
  execute: async ({ context }) => {
    return await getMovie(context.genre, context.keywords, context.decade, context.amount, context.sort);
  },
})

// Main function to get movies from TMDB API
const getMovie = async (genre?: string, keywords?: string, decade?: string, amount?: number, sort?: string) => {
  if (!process.env.TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not set');
  }

  const params = new URLSearchParams();
  
  // Always filter out non-released movies
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  params.append('primary_release_date.lte', today);
  
  // Build API parameters
  addGenreFilter(params, genre);
  addKeywordFilters(params, keywords);
  addDecadeFilter(params, decade);
  addSortingAndPagination(params, sort);
  
  // Make API call
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&${params.toString()}`;
  console.log('🎬 Final API Call:', url);
  const response = await fetch(url);
  const data = await response.json();
  
  // Process and return results
  return formatMovieResults(data.results, amount);
}

// Helper function to add genre filter
const addGenreFilter = (params: URLSearchParams, genre?: string) => {
  if (!genre) return;
  
  // Check if it's already a number (genre ID)
  if (!isNaN(Number(genre))) {
    params.append('with_genres', genre);
    return;
  }
  
  // Otherwise treat as genre name and convert to ID
  const genreKey = genre.charAt(0).toUpperCase() + genre.slice(1).toLowerCase();
  const genreIdValue = genreId[genreKey as keyof typeof genreId];
  if (genreIdValue) {
    params.append('with_genres', genreIdValue.toString());
  }
}

// Helper function to add keyword filters
const addKeywordFilters = (params: URLSearchParams, keywords?: string) => {
  if (!keywords) return;
  
  const keywordList = keywords
    .split(/[,\s]+|and|or/i)
    .map(k => k.trim())
    .filter(k => k.length > 0);
  
  keywordList.forEach(keyword => {
    params.append('with_keywords', keyword);
  });
}

// Helper function to add decade filter
const addDecadeFilter = (params: URLSearchParams, decade?: string) => {
  if (!decade) return;
  
  let startYear: string, endYear: string;
  
  if (decade.includes('s')) {
    const decadeNum = decade.replace('s', '');
    startYear = decadeNum;
    endYear = (parseInt(decadeNum) + 9).toString();
  } else {
    startYear = decade;
    endYear = decade;
  }
  
  params.append('primary_release_date.gte', `${startYear}-01-01`);
  params.append('primary_release_date.lte', `${endYear}-12-31`);
}

// Helper function to determine sorting and add pagination
const addSortingAndPagination = (params: URLSearchParams, sort?: string) => {
  if (!sort) {
    sort = getRandomSort();
    addRandomVoteFilters(params); // Add vote filtering for random sort
  }

  params.append('sort_by', sort);

  // Use page 1 for specific requests, random pages for variety
  let page: number;
  if (sort && (sort.includes('top rated') || sort.includes('popular'))) {
    page = 1; // Get the actual top results
  } else {
    page = Math.floor(Math.random() * 5) + 1; // Random page for variety
  }
  
  params.append('page', page.toString());
}

// Helper function to get random sorting option
const getRandomSort = (): string => {
  const sortOptions = ['popularity.desc', 'vote_average.desc', 'release_date.desc', 'revenue.desc'];
  return sortOptions[Math.floor(Math.random() * sortOptions.length)];
}

// Helper function to get random movies
const addRandomVoteFilters = (params: URLSearchParams) => {
  params.append('vote_average.gte', '1.0');
  params.append('vote_average.lte', '10.0');
}

// Helper function to format movie results
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
  })) || [];
  
  return { movies };
}