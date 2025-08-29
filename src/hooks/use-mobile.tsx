import * as React from "react"

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      // Simple check: screen width < 1024px OR mobile user agent
      const isMobile = window.innerWidth < 1024 ||
        /Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent)
      setIsMobile(isMobile)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

// Even simpler hook for overlay
export function useSmallScreenOverlay() {
  const [showOverlay, setShowOverlay] = React.useState(false)

  React.useEffect(() => {
    const checkScreen = () => {
      const isSmall = window.innerWidth < 1024 ||
        /Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent)
      setShowOverlay(isSmall)
    }

    checkScreen()
    window.addEventListener('resize', checkScreen)

    return () => window.removeEventListener('resize', checkScreen)
  }, [])

  return showOverlay
}
