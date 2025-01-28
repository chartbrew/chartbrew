function isMac() {
  // Check the modern userAgentData API
  if (navigator.userAgentData?.platform) {
    return navigator.userAgentData.platform.toLowerCase().includes("mac");
  }

  // Fallback to the older navigator.platform API
  if (navigator.platform) {
    return navigator.platform?.toLowerCase().includes("mac");
  }

  // Final fallback: Parse the userAgent string
  if (navigator.userAgent) {
    return navigator.userAgent?.toLowerCase().includes("mac");
  }

  // Default to false if no information is available
  return false;
}

export default isMac;