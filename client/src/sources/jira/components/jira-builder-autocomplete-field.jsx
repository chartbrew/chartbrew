import React from "react";
import PropTypes from "prop-types";
import {
  Autocomplete,
  EmptyState,
  Label,
  ListBox,
  SearchField,
  Tag,
  TagGroup,
  useFilter,
} from "@heroui/react";

function findItem(items, key) {
  return items.find((item) => `${item.id}` === `${key}`);
}

function JiraBuilderAutocompleteField(props) {
  const {
    label,
    name,
    placeholder,
    items,
    value,
    selectionMode,
    onChange,
    className,
    isDisabled,
    emptyLabel,
  } = props;
  const { contains } = useFilter({ sensitivity: "base" });
  const selectedValues = selectionMode === "multiple"
    ? (Array.isArray(value) ? value.map((item) => `${item}`) : [])
    : (value ? `${value}` : null);
  const selectedKeys = selectionMode === "multiple"
    ? selectedValues
    : (selectedValues ? [selectedValues] : []);
  const displayItems = [
    ...items,
    ...selectedKeys
      .filter((key) => !findItem(items, key))
      .map((key) => ({
        id: key,
        label: key,
        shortLabel: key,
        searchText: key,
      })),
  ];

  const removeTags = (keys) => {
    const nextKeys = (selectedValues || []).filter((key) => !keys.has(key));
    onChange(nextKeys);
  };

  return (
    <Autocomplete
      allowsEmptyCollection
      className={className}
      fullWidth
      isDisabled={isDisabled}
      name={name}
      placeholder={placeholder}
      selectionMode={selectionMode}
      value={selectedValues}
      onChange={(keys) => onChange(selectionMode === "multiple" ? (keys || []) : keys)}
      variant="secondary"
    >
      <Label>{label}</Label>
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ defaultChildren, isPlaceholder, state }) => {
            if (selectionMode !== "multiple" || isPlaceholder || state.selectedItems.length === 0) {
              return defaultChildren;
            }

            const selectedKeys = state.selectedItems.map((item) => item.key);
            return (
              <TagGroup size="sm" onRemove={removeTags} variant="surface">
                <TagGroup.List>
                  {selectedKeys.map((selectedKey) => {
                    const item = findItem(displayItems, selectedKey);
                    return (
                      <Tag key={selectedKey} id={selectedKey}>
                        {item?.shortLabel || item?.label || selectedKey}
                      </Tag>
                    );
                  })}
                </TagGroup.List>
              </TagGroup>
            );
          }}
        </Autocomplete.Value>
        <Autocomplete.ClearButton />
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          <SearchField autoFocus name={`${name}-search`} variant="secondary">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => <EmptyState>{emptyLabel}</EmptyState>}>
            {displayItems.map((item) => (
              <ListBox.Item key={item.id} id={`${item.id}`} textValue={item.searchText || item.label}>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{item.label}</span>
                  {item.description && (
                    <span className="truncate text-xs text-muted">{item.description}</span>
                  )}
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

JiraBuilderAutocompleteField.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  items: PropTypes.array,
  value: PropTypes.oneOfType([PropTypes.array, PropTypes.string, PropTypes.number]),
  selectionMode: PropTypes.oneOf(["single", "multiple"]),
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
  isDisabled: PropTypes.bool,
  emptyLabel: PropTypes.string,
};

JiraBuilderAutocompleteField.defaultProps = {
  placeholder: "Select...",
  items: [],
  value: null,
  selectionMode: "single",
  className: "",
  isDisabled: false,
  emptyLabel: "No results found",
};

export default JiraBuilderAutocompleteField;
