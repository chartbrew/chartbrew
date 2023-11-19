import React from "react";
import { useParams } from "react-router";
import { useSelector } from "react-redux";

function DatasetBuilder() {
  const params = useParams();
  
  const dataset = useSelector((state) => state.dataset.data.find((d) => `${d.id}` === `${params.datasetId}`));

  return (
    <div className="grid grid-cols-12">
      <div className="col-span-12 md:col-span-4">
        <span className="text-lg font-bold">Dataset cofiguration</span>
      </div>

      <div className="col-span-12 md:col-span-8">
        This is the chart panel
      </div>
    </div>
  );
}

export default DatasetBuilder
