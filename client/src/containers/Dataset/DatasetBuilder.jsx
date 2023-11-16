import React from "react";

function DatasetBuilder() {
  return (
    <div className="grid grid-cols-12">
      <div className="col-span-12 md:col-span-4">
        This is the configuration panel
      </div>

      <div className="col-span-12 md:col-span-8">
        This is the chart panel
      </div>
    </div>
  );
}

export default DatasetBuilder
