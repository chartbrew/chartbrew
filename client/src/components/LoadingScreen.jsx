import React from "react"

function LoadingScreen() {
  return (
    <div className="container mx-auto pt-unit-lg">
      <div className="flex justify-center">
        <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-32 w-32"></div>
      </div>
    </div>
  )
}

export default LoadingScreen
