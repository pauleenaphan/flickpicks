import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { searchForMovie } from "../api/tmdb/utils";

// Helper functions to manage library in agent memory with user identification
export const getLibraryFromMemory = async (context: any) => {
  const memory = context.agent?.memory;
  
  // Try different ways to get resourceId
  const resourceId = context.resourceId || 
                    context.threadId || 
                    context.userId || 
                    context.sessionId || 
                    'default_user';
  
  console.log('🔍 Getting library for resourceId:', resourceId);
  console.log('🔍 Available context keys:', Object.keys(context));
  
  if (!memory) {
    console.log('❌ No memory available');
    return [];
  }
  
  try {
    const libraryData = await memory.get(`user_library_${resourceId}`);
    console.log('📚 Raw library data:', libraryData);
    const parsed = libraryData ? JSON.parse(libraryData) : [];
    console.log('📚 Parsed library:', parsed);
    return parsed;
  } catch (error) {
    console.error('❌ Error getting library from memory:', error);
    return [];
  }
};

export const saveLibraryToMemory = async (context: any, library: any[]) => {
  const memory = context.agent?.memory;
  
  // Try different ways to get resourceId (same as getLibraryFromMemory)
  const resourceId = context.resourceId || 
                    context.threadId || 
                    context.userId || 
                    context.sessionId || 
                    'default_user';
  
  console.log('💾 Saving library for resourceId:', resourceId);
  console.log('💾 Library to save:', library);
  
  if (!memory) {
    console.log('❌ No memory available for saving');
    return;
  }
  
  try {
    await memory.set(`user_library_${resourceId}`, JSON.stringify(library));
    console.log('✅ Library saved successfully');
  } catch (error) {
    console.error('❌ Failed to save library to memory:', error);
  }
};

// Basic library tools to interact with the user's library
export const addToLibraryTool = createTool({
  id: 'add-to-library',
  description: 'Add a movie to the user\'s library',
  inputSchema: z.object({ 
    title: z.string(),
    genre: z.string(),
    releaseYear: z.string(),
    voteAverage: z.number()
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ context }) => {
    console.log('➕ Adding to library with full context:', JSON.stringify(context, null, 2));
    const { title, genre, releaseYear, voteAverage } = context;
    
    // Get current library from memory
    const moviesSeen = await getLibraryFromMemory(context);
    
    // Check if already in library
    if (moviesSeen.find((m: any) => m.movie === title)) {
      return { message: 'Movie already in library' };
    }
    
    // Verify movie exists on TMDB
    const searchResult = await searchForMovie(title);
    if (!searchResult.found) {
      const suggestions = searchResult.suggestions?.join(', ');
      return { message: suggestions ? `Movie not found. Did you mean: ${suggestions}?` : 'Movie does not exist' };
    }
    
    // Add movie to library
    moviesSeen.push({
      movie: title,
      genre,
      plot: searchResult.movieData?.overview || 'No description available',
      releaseYear,
      vote_average: voteAverage
    });
    
    // Save updated library to memory
    await saveLibraryToMemory(context, moviesSeen);
    
    return { message: 'Movie added to library' };
  },
});

export const removeFromLibraryTool = createTool({
  id: 'remove-from-library',
  description: 'Remove a movie from the user\'s library',
  inputSchema: z.object({ title: z.string() }),
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ context }) => {
    const { title } = context;
    
    // Get current library from memory
    const moviesSeen = await getLibraryFromMemory(context);
    const index = moviesSeen.findIndex((m: any) => m.movie === title);
    
    if (index > -1) {
      moviesSeen.splice(index, 1);
      // Save updated library to memory
      await saveLibraryToMemory(context, moviesSeen);
      return { message: 'Movie removed from library' };
    }
    return { message: 'Movie not found in library' };
  },
});

export const viewLibraryTool = createTool({
  id: 'view-library',
  description: 'View the user\'s library',
  outputSchema: z.object({ message: z.string() }),
  execute: async ({ context }) => {
    console.log('👀 Viewing library with context:', context);
    // Get current library from memory
    const moviesSeen = await getLibraryFromMemory(context);
    console.log('👀 Movies seen:', moviesSeen);
    const movieList = moviesSeen.map((m: any) => m.movie).join(', ');
    console.log('👀 Movie list string:', movieList);
    return { message: 'Library: ' + movieList };
  },
});