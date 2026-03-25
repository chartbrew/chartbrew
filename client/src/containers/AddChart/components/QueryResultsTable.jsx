import { useState } from "react";
import PropTypes from "prop-types";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Pagination,
  Button,
  Popover,
} from "@heroui/react";

function QueryResultsTable({ result }) {
  const [resultsPage, setResultsPage] = useState(1);

  const getResultHeaderRows = () => {
    if (!result) return ["Results"];

    try {
      const parsedResult = JSON.parse(result);
      const headers = [];
      parsedResult.forEach((o) => {
        Object.keys(o).forEach((attr) => {
          if (!headers.includes(attr)) {
            headers.push(attr);
          }
        });
      });

      if (headers.length === 0) return ["Results"];

      return headers;
    } catch (e) {
      return ["Results"];
    }
  };

  const getResultBodyRows = (page) => {
    if (!result) return [];

    const perPage = 10;

    try {
      const parsedResult = JSON.parse(result);
      const allRows = page ? parsedResult.slice((page - 1) * perPage, page * perPage) : parsedResult;
      const headers = getResultHeaderRows();
      return allRows.map((row) => {
        const newRow = {};
        headers.forEach((header) => {
          newRow[header] = row[header] || "";
        });
        return newRow;
      });
    } catch (e) {
      return [];
    }
  };

  return (
    <div>
      <div className="w-full">
        <Table
          isStriped
          className="sqlbuilder-result-tut"
          aria-label="Results table"
        >
          {getResultHeaderRows()?.length > 0 && (
            <TableHeader>
              {getResultHeaderRows().map((h) => (
                <TableColumn key={h}>{h}</TableColumn>
              ))}
            </TableHeader>
          )}
          <TableBody emptyContent={"Run a query to see the results"}>
            {getResultBodyRows(resultsPage).map((row, i) => (
              <TableRow key={i}>
                {Object.keys(row).map((key) => (
                  <TableCell key={key}>
                    {typeof row[key] === "object" ? (
                      <Popover>
                        <Popover.Trigger>
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                          >
                            {Array.isArray(row[key]) ? "Array" : "Object"}
                          </Button>
                        </Popover.Trigger>
                        <Popover.Content>
                          <Popover.Dialog>
                            <pre>{JSON.stringify(row[key], null, 2)}</pre>
                          </Popover.Dialog>
                        </Popover.Content>
                      </Popover>
                    ) : (
                      typeof row[key] === "string" && row[key].length > 100 ? (
                        <div className="relative">
                          <span className="block truncate w-[200px]">{row[key]}</span>
                        </div>
                      ) : row[key]
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="h-4" />
      <div>
        <Pagination
          total={getResultBodyRows().length > 0 ? Math.ceil(getResultBodyRows().length / 10) : 1}
          onChange={(page) => setResultsPage(page)}
          page={resultsPage}
          size="sm"
          aria-label="Pagination"
        />
      </div>
    </div>
  );
}

QueryResultsTable.propTypes = {
  result: PropTypes.string,
};

QueryResultsTable.defaultProps = {
  result: "",
};

export default QueryResultsTable;

