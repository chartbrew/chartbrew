// return the field selector string needed by the backend
// takes the row index and the data as an array with lines from a stringified JSON
export default function (line) {
  let lineText = line.lead.document.$lines[line.lead.row];
  lineText = lineText.substring(lineText.indexOf("\"") + 1, lineText.indexOf(":") - 1);
  const fieldString = [lineText];

  return extract(line.lead.row, line.lead.document.$lines, fieldString);
}

function extract(row, lines, fieldString) {
  // go back in the lines array
  let isClosed = false;
  let bracketType = "";
  for (let i = row - 1; i >= 0; i--) {
    const line = lines[i].replace(/\s/g, "");

    if (line === "}" || line === "},") {
      isClosed = true;
      bracketType = "curly";
    }

    if (line.indexOf(":{") > -1) {
      if (!isClosed && bracketType !== "square") {
        fieldString.unshift(
          line.substring(line.indexOf("\"") + 1, line.indexOf(":") - 1)
        );

        isClosed = false;
        bracketType = "";
      } else {
        isClosed = false;
        bracketType = "";
      }
    }

    if (line === "]" || line === "],") {
      isClosed = true;
      bracketType = "square";
    }

    if (line.indexOf(":[") > -1) {
      if (!isClosed && bracketType !== "curly") {
        fieldString.unshift(
          `${line.substring(line.indexOf("\"") + 1, line.indexOf(":") - 1)}[]`
        );

        isClosed = false;
        bracketType = "";
      } else {
        isClosed = false;
        bracketType = "";
      }
    }
  }

  return fieldString.join(".");
}
