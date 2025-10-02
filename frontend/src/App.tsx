import React, { useState } from 'react'

import './index.css'
import { Library } from './library'
import { Chat } from './chat'

function App() {
  const [showLibrary, setShowLibrary] = useState(false)

  return (
    <div>
      <h1>FlickPicks</h1>
      <p> Chat with Flicky below, he's here to help you find the perfect movie.</p>
      <Chat />
      <button onClick={() => setShowLibrary(!showLibrary)}>Show Library</button>
      {showLibrary && <Library />}
    </div>
  )
}

export default App
