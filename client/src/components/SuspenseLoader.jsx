import React from "react";
import cbLogoInverted from "../assets/logo_inverted.png";

function SuspenseLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <img 
        src={cbLogoInverted} 
        alt="Chartbrew Logo" 
        width={80} 
        className="animate-pulse"
      />
    </div>
  );
}

export default SuspenseLoader;
