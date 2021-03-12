import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Menu } from "semantic-ui-react";
import TableComponent from "./TableComponent";

function TableContainer(props) {
  const { tabularData, height } = props;

  const [activeDataset, setActiveDataset] = useState("");

  useEffect(() => {
    if (tabularData && !activeDataset) {
      setActiveDataset(Object.keys(tabularData)[0]);
    } else if (!tabularData[activeDataset]) {
      setActiveDataset(Object.keys(tabularData)[0]);
    }
  }, [tabularData]);

  return (
    <div>
      {Object.keys(tabularData).length > 1 && (
        <Menu secondary>
          {Object.keys(tabularData).map((dataset) => {
            return (
              <Menu.Item
                name={dataset}
                onClick={() => setActiveDataset(dataset)}
                active={activeDataset === dataset}
              />
            );
          })}
        </Menu>
      )}
      {activeDataset && tabularData[activeDataset] && tabularData[activeDataset].columns && (
        <TableComponent
          height={height}
          columns={tabularData[activeDataset].columns}
          data={tabularData[activeDataset].data}
        />
      )}
    </div>
  );
}

TableContainer.defaultProps = {
  height: 300,
};

TableContainer.propTypes = {
  tabularData: PropTypes.object.isRequired,
  height: PropTypes.number,
};

export default TableContainer;
