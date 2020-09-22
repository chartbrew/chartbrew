import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Dropdown } from "semantic-ui-react";

function DatasetData(props) {
  const { requestResult } = props;

  const [fieldOptions, setFieldOptions] = useState([]);
  const [selectedField, setSelectedField] = useState("");

  useEffect(() => {
    if (requestResult && requestResult.data && requestResult.data[0]) {
      const tempFieldOptions = [];
      Object.keys(requestResult.data[0]).forEach((field) => {
        tempFieldOptions.push({
          key: field,
          text: field,
          value: field,
        });
      });
      setFieldOptions(tempFieldOptions);
    }
  }, [requestResult]);

  const _selectField = (e, data) => {
    setSelectedField(data.value);
  };

  if (!requestResult) {
    return (
      <div>
        <p><i> - Fetch some data first - </i></p>
      </div>
    );
  }

  return (
    <div>
      <p><label>Select a date field</label></p>
      <Dropdown
        button
        className="icon"
        floating
        labeled
        icon="calendar"
        options={fieldOptions}
        search
        text={selectedField || "Select a date field"}
        onChange={_selectField}
      />
      <div style={{ marginTop: 20 }}>
        <label>{"where "}</label>
        <Dropdown
          button
          options={fieldOptions}
          search
          text={"age"}
          onChange={_selectField}
        />
        <Dropdown
          button
          options={fieldOptions}
          search
          text={">"}
          onChange={_selectField}
        />
        <Dropdown
          button
          options={fieldOptions}
          search
          text={"45"}
          onChange={_selectField}
        />
      </div>
    </div>
  );
}

DatasetData.propTypes = {
  requestResult: PropTypes.object.isRequired,
};

export default DatasetData;
