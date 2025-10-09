// Searches for a movie using the TMDB API for the user to add to their library
const searchForMovie = async (query: string) => {
  console.log("search term user is looking for: ", query);
  console.log("api key: ", import.meta.env.VITE_TMDB_API_KEY);
  const response = await fetch(`https://api.themoviedb.org/3/search/movie?query=${query}&api_key=${import.meta.env.VITE_TMDB_API_KEY}`);
  
  const data = await response.json();
  console.log("search results: ", data);
  return data;
}

export default searchForMovie;