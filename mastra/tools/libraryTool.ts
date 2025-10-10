import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchForMovie } from "../api/tmdb/utils";

// Basic library tools to interact with the user's library
export const addToLibraryTool = createTool({
  id: 'add-to-library',
  description: 'Add a movie to the user\'s library',
  inputSchema: z.object({ 
    title: z.string(),
    genre: z.string().optional(),
    releaseYear: z.string().optional(),
    voteAverage: z.number().optional(),
    plot: z.string().optional()
  }),
  outputSchema: z.object({ 
    message: z.string(),
    instruction: z.string().optional(),
    data: z.any().optional()
  }),
  execute: async ({ context }) => {
    console.log('➕ Adding to library with context:', JSON.stringify(context, null, 2));
    const { title, genre, releaseYear, voteAverage, plot } = context;
    
    // Verify movie exists on TMDB
    const searchResult = await searchForMovie(title);
    if (!searchResult.found) {
      const suggestions = searchResult.suggestions?.join(', ');
      return { 
        message: suggestions ? `Movie not found. Did you mean: ${suggestions}?` : 'Movie does not exist',
        instruction: 'MOVIE_NOT_FOUND'
      };
    }
    
    // Create movie object for localStorage
    const movieToAdd = {
      movie: title,
      genre: genre || searchResult.movieData?.genre_ids?.[0]?.toString() || 'Unknown',
      plot: plot || searchResult.movieData?.overview || 'No description available',
      releaseYear: releaseYear || (searchResult.movieData?.release_date ? new Date(searchResult.movieData.release_date).getFullYear().toString() : 'Unknown'),
      vote_average: voteAverage || searchResult.movieData?.vote_average || 0
    };
    
    return { 
      message: `ADD_MOVIE_TO_LOCALSTORAGE - I'll add "${title}" to your library. Movie data: ${JSON.stringify(movieToAdd)}`,
      instruction: 'ADD_MOVIE_TO_LOCALSTORAGE',
      data: movieToAdd
    };
  },
});

export const removeFromLibraryTool = createTool({
  id: 'remove-from-library',
  description: 'Remove a movie from the user\'s library',
  inputSchema: z.object({ title: z.string() }),
  outputSchema: z.object({ 
    message: z.string(),
    instruction: z.string().optional(),
    data: z.any().optional()
  }),
  execute: async ({ context }) => {
    const { title } = context;
    
    return { 
      message: `Please remove "${title}" from your localStorage library.`,
      instruction: 'REMOVE_MOVIE_FROM_LOCALSTORAGE',
      data: { title }
    };
  },
});

export const viewLibraryTool = createTool({
  id: 'view-library',
  description: 'View the user\'s library',
  outputSchema: z.object({ 
    message: z.string(),
    instruction: z.string().optional()
  }),
  execute: async ({ context }) => {
    console.log('🔍 FLICKY DEBUG - viewLibraryTool EXECUTED!');
    console.log('🔍 FLICKY DEBUG - Context received:', context);
    console.log('🔍 FLICKY DEBUG - Returning instruction: READ_LIBRARY_FROM_LOCALSTORAGE');
    
    return { 
      message: 'READ_LIBRARY_FROM_LOCALSTORAGE',
      instruction: 'READ_LIBRARY_FROM_LOCALSTORAGE'
    };
  },
});