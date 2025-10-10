// Calls backend api to search for movies
const searchForMovie = async (query: string) => {
  console.log("search term user is looking for: ", query);
  
  try {
    const response = await fetch(`/api/search-movies?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("search results: ", data);
    return data;
  } catch (error) {
    console.error("Error searching for movies:", error);
    throw error;
  }
}

export default searchForMovie;