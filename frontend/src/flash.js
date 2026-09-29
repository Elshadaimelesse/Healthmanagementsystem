import { createContext, useContext } from 'react'

// Any page can call: const flash = useFlash(); flash('Saved', 'success')
export const FlashContext = createContext(() => {})
export const useFlash = () => useContext(FlashContext)
