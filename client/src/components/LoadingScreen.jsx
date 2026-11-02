import React from "react";
import PropTypes from "prop-types";
import CupLoader from "./CupLoader";

function LoadingScreen({ label = "Loading" }) {
  return (
    <div className="flex h-[70vh] items-center justify-center bg-background">
      <CupLoader label={label} />
    </div>
  );
}

LoadingScreen.propTypes = {
  label: PropTypes.string,
};

export default LoadingScreen;
