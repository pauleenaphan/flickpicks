import { BiSolidCameraMovie } from "react-icons/bi";

import './index.css'
import { Library } from './library'
import Chat from './chat'

function App() {
  return (
    <div className='flex flex-col items-center py-12 md:h-screen bg-gray-900'>
      <div className='flex flex-row items-center gap-2'>
        <h1 className='text-4xl font-bold text-white font-display'>FlickPicks</h1>
        <BiSolidCameraMovie className='text-4xl text-white'/>
      </div>
      <p className='text-base text-gray-400'> Chat with Flicky below, he's here to help you find the perfect movie.</p>
      <div className='flex flex-col md:flex-row gap-8 items-start w-full h-[95%] px-12 pt-12'>
        <Library />
        <Chat />
      </div>
      
    </div>
  )
}

export default App
