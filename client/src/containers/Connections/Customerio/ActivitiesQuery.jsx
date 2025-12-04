import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import {
  Input, Select, SelectItem, Checkbox, Spacer, Divider,
  Chip, Autocomplete, AutocompleteItem, Button,
} from "@heroui/react";
import { LuActivity, LuX, LuBox } from "react-icons/lu";
import { useDispatch, useSelector } from "react-redux";
import { runHelperMethod } from "../../../slices/connection";
import { selectTeam } from "../../../slices/team";

const activityTypes = [
  { text: "Add relationship", value: "add_relationship" },
  { text: "Anonymous merge", value: "anon_merge" },
  { text: "Attempted action", value: "attempted_action" },
  { text: "Attempted email", value: "attempted_email" },
  { text: "Attempted in-app", value: "attempted_in_app" },
  { text: "Attempted push", value: "attempted_push" },
  { text: "Attempted Slack", value: "attempted_slack" },
  { text: "Attempted Twilio", value: "attempted_twilio" },
  { text: "Attempted webhook", value: "attempted_webhook" },
  { text: "Attribute change", value: "attribute_change" },
  { text: "Bounced action", value: "bounced_action" },
  { text: "Bounced email", value: "bounced_email" },
  { text: "Bounced push", value: "bounced_push" },
  { text: "Bounced Twilio", value: "bounced_twilio" },
  { text: "Clicked action", value: "clicked_action" },
  { text: "Clicked content", value: "clicked_content" },
  { text: "Clicked email", value: "clicked_email" },
  { text: "Clicked in-app", value: "clicked_in_app" },
  { text: "Clicked push", value: "clicked_push" },
  { text: "Clicked Twilio", value: "clicked_twilio" },
  { text: "Clicked webhook", value: "clicked_webhook" },
  { text: "Converted action", value: "converted_action" },
  { text: "Converted content", value: "converted_content" },
  { text: "Converted email", value: "converted_email" },
  { text: "Converted in-app", value: "converted_in_app" },
  { text: "Converted Slack", value: "converted_slack" },
  { text: "Converted Twilio", value: "converted_twilio" },
  { text: "Converted webhook", value: "converted_webhook" },
  { text: "Deferred action", value: "deferred_action" },
  { text: "Deferred email", value: "deferred_email" },
  { text: "Deferred in-app", value: "deferred_in_app" },
  { text: "Deferred push", value: "deferred_push" },
  { text: "Deferred Slack", value: "deferred_slack" },
  { text: "Deferred Twilio", value: "deferred_twilio" },
  { text: "Deferred webhook", value: "deferred_webhook" },
  { text: "Delete relationship", value: "delete_relationship" },
  { text: "Delivered action", value: "delivered_action" },
  { text: "Delivered email", value: "delivered_email" },
  { text: "Delivered push", value: "delivered_push" },
  { text: "Delivered Twilio", value: "delivered_twilio" },
  { text: "Device change", value: "device_change" },
  { text: "Drafted action", value: "drafted_action" },
  { text: "Drafted email", value: "drafted_email" },
  { text: "Drafted in-app", value: "drafted_in_app" },
  { text: "Drafted push", value: "drafted_push" },
  { text: "Drafted Slack", value: "drafted_slack" },
  { text: "Drafted Twilio", value: "drafted_twilio" },
  { text: "Drafted webhook", value: "drafted_webhook" },
  { text: "Dropped action", value: "dropped_action" },
  { text: "Dropped email", value: "dropped_email" },
  { text: "Dropped push", value: "dropped_push" },
  { text: "Dropped Twilio", value: "dropped_twilio" },
  { text: "Dropped webhook", value: "dropped_webhook" },
  { text: "Event", value: "event" },
  { text: "Failed action", value: "failed_action" },
  { text: "Failed attribute change", value: "failed_attribute_change" },
  { text: "Failed batch update", value: "failed_batch_update" },
  { text: "Failed email", value: "failed_email" },
  { text: "Failed event", value: "failed_event" },
  { text: "Failed in-app", value: "failed_in_app" },
  { text: "Failed object journeys", value: "failed_object_journeys" },
  { text: "Failed push", value: "failed_push" },
  { text: "Failed query collection", value: "failed_query_collection" },
  { text: "Failed Slack", value: "failed_slack" },
  { text: "Failed Twilio", value: "failed_twilio" },
  { text: "Failed webhook", value: "failed_webhook" },
  { text: "Opened action", value: "opened_action" },
  { text: "Opened email", value: "opened_email" },
  { text: "Opened in-app", value: "opened_in_app" },
  { text: "Opened push", value: "opened_push" },
  { text: "Page", value: "page" },
  { text: "Profile create", value: "profile_create" },
  { text: "Profile delete", value: "profile_delete" },
  { text: "Profile merge", value: "profile_merge" },
  { text: "Relationship attribute change", value: "relationship_attribute_change" },
  { text: "Relationship failed attribute change", value: "relationship_failed_attribute_change" },
  { text: "Screen", value: "screen" },
  { text: "Sent action", value: "sent_action" },
  { text: "Sent email", value: "sent_email" },
  { text: "Sent in-app", value: "sent_in_app" },
  { text: "Sent push", value: "sent_push" },
  { text: "Sent Slack", value: "sent_slack" },
  { text: "Sent Twilio", value: "sent_twilio" },
  { text: "Sent webhook", value: "sent_webhook" },
  { text: "Skipped update", value: "skipped_update" },
  { text: "Spammed email", value: "spammed_email" },
  { text: "Suppressed Twilio", value: "suppressed_twilio" },
  { text: "Topic unsubscribed email", value: "topic_unsubscribed_email" },
  { text: "Undeliverable action", value: "undeliverable_action" },
  { text: "Undeliverable email", value: "undeliverable_email" },
  { text: "Undeliverable in-app", value: "undeliverable_in_app" },
  { text: "Undeliverable push", value: "undeliverable_push" },
  { text: "Undeliverable Slack", value: "undeliverable_slack" },
  { text: "Undeliverable Twilio", value: "undeliverable_twilio" },
  { text: "Undeliverable webhook", value: "undeliverable_webhook" },
  { text: "Unsubscribed action", value: "unsubscribed_action" },
  { text: "Unsubscribed email", value: "unsubscribed_email" },
  { text: "Viewed content", value: "viewed_content" },
  { text: "Webhook event", value: "webhook_event" }
];

const idTypes = [
  { text: "ID", value: "id" },
  { text: "Email", value: "email" },
  { text: "Customer.io ID (cio_id)", value: "cio_id" },
];

function ActivitiesQuery({
  onUpdate,
  request = null,
  connectionId,
}) {
  const [activityType, setActivityType] = useState("");
  const [eventName, setEventName] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [idType, setIdType] = useState("id");
  const [limit, setLimit] = useState(100);
  const [allActivityTypes, setAllActivityTypes] = useState(activityTypes);
  const [loading, setLoading] = useState(false);
  const [hasEventNameChanges, setHasEventNameChanges] = useState(false);
  const [hasCustomerIdChanges, setHasCustomerIdChanges] = useState(false);
  const [hasLimitChanges, setHasLimitChanges] = useState(false);

  const dispatch = useDispatch();
  const initRef = useRef(false);
  const team = useSelector(selectTeam);
  
  useEffect(() => {
    if (request?.configuration) {
      setActivityType(request.configuration.activityType || "");
      setEventName(request.configuration.eventName || "");
      setDeleted(request.configuration.deleted || false);
      setCustomerId(request.configuration.customerId || "");
      setIdType(request.configuration.idType || "id");
      setLimit(request.configuration.limit ?? 100);
    }
  }, [request]);

  useEffect(() => {
    // Fetch object types when component mounts
    if (!initRef.current && connectionId && team?.id) {
      setLoading(true);
      initRef.current = true;
      dispatch(runHelperMethod({
        team_id: team?.id,
        connection_id: connectionId,
        methodName: "getAllObjectTypes"
      }))
        .then((data) => {
          const objectTypes = data.payload;
          if (objectTypes && Array.isArray(objectTypes)) {
            const customActivityTypes = objectTypes.map((objType) => [
              {
                text: `${objType.name} - Add relationship`,
                value: `_o:${objType.id}:add_relationship`
              },
              {
                text: `${objType.name} - Attribute change`,
                value: `_o:${objType.id}:attribute_change`
              },
              {
                text: `${objType.name} - Create`,
                value: `_o:${objType.id}:create`
              },
              {
                text: `${objType.name} - Delete`,
                value: `_o:${objType.id}:delete`
              },
              {
                text: `${objType.name} - Delete relationship`,
                value: `_o:${objType.id}:delete_relationship`
              },
              {
                text: `${objType.name} - Failed attribute change`,
                value: `_o:${objType.id}:failed_attribute_change`
              }
            ]).flat();

            const relationshipActivityTypes = objectTypes.map((objType) => [
              {
                text: `${objType.name} - Relationship attribute change`,
                value: `_r:${objType.id}:attribute_change`
              },
              {
                text: `${objType.name} - Relationship failed attribute change`,
                value: `_r:${objType.id}:failed_attribute_change`
              }
            ]).flat();

            setAllActivityTypes([
              ...activityTypes,
              ...customActivityTypes,
              ...relationshipActivityTypes
            ]);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [connectionId, team]);

  const _handleActivityTypeChange = (value) => {
    setActivityType(value);
    onUpdate({
      activityType: value,
      eventName,
      deleted,
      customerId,
      idType,
      limit,
    });
  };

  const _handleEventNameChange = (value) => {
    setEventName(value);
    setHasEventNameChanges(value !== request?.configuration?.eventName);
  };

  const _handleEventNameSave = () => {
    onUpdate({
      activityType,
      eventName,
      deleted,
      customerId,
      idType,
      limit,
    });
    setHasEventNameChanges(false);
  };

  const _handleCustomerIdChange = (value) => {
    setCustomerId(value);
    setHasCustomerIdChanges(value !== request?.configuration?.customerId);
  };

  const _handleCustomerIdSave = () => {
    onUpdate({
      activityType,
      eventName,
      deleted,
      customerId,
      idType,
      limit,
    });
    setHasCustomerIdChanges(false);
  };

  const _handleIdTypeChange = (value) => {
    setIdType(value);
    onUpdate({
      activityType,
      eventName,
      deleted,
      customerId,
      idType: value,
      limit,
    });
  };

  const _handleDeletedChange = (value) => {
    setDeleted(value);
    onUpdate({
      activityType,
      eventName,
      deleted: value,
      customerId,
      idType,
      limit,
    });
  };

  const _handleLimitChange = (value) => {
    setLimit(value);
    setHasLimitChanges(value !== request?.configuration?.limit);
  };

  const _handleLimitSave = () => {
    onUpdate({
      activityType,
      eventName,
      deleted,
      customerId,
      idType,
      limit,
    });
    setHasLimitChanges(false);
  };

  const _isObjectType = (value) => {
    return value.startsWith("_o:") || value.startsWith("_r:");
  };

  const _getActivityTypeName = (value) => {
    const found = allActivityTypes.find((t) => t.value === value);
    return found ? found.text : value;
  };

  const _getIdTypeName = (value) => {
    const found = idTypes.find((t) => t.value === value);
    return found ? found.text : value;
  };

  return (
    <div className="w-full mt-2">
      <div className="flex flex-col gap-2">
        <div className="text-sm">Filter activities</div>
        <Autocomplete
          label="Activity Type"
          placeholder="Select activity type"
          selectedKey={activityType}
          onSelectionChange={(key) => _handleActivityTypeChange(key)}
          fullWidth
          variant="bordered"
          isLoading={loading}
          aria-label="Activity Type"
        >
          {allActivityTypes.map((type) => (
            <AutocompleteItem 
              key={type.value} 
              textValue={type.text}
              startContent={_isObjectType(type.value) ? <LuBox /> : <LuActivity />}
            >
              {type.text}
            </AutocompleteItem>
          ))}
        </Autocomplete>
        <Input
          label="Event Name"
          placeholder="e.g. purchase"
          value={eventName}
          onChange={(e) => _handleEventNameChange(e.target.value)}
          fullWidth
          variant="bordered"
          endContent={hasEventNameChanges && (
            <Button
              size="sm"
              color="success"
              variant="flat"
              onPress={_handleEventNameSave}
            >
              Save
            </Button>
          )}
        />
      </div>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div className="flex flex-col gap-2">
        <Input
          label="Customer ID"
          placeholder="Enter customer ID"
          value={customerId}
          onChange={(e) => _handleCustomerIdChange(e.target.value)}
          fullWidth
          variant="bordered"
          endContent={hasCustomerIdChanges && (
            <Button
              size="sm"
              color="success"
              variant="flat"
              onPress={_handleCustomerIdSave}
            >
              Save
            </Button>
          )}
        />
        {customerId && (
          <Select
            label="ID Type"
            selectedKeys={[idType]}
            onChange={(e) => _handleIdTypeChange(e.target.value)}
            fullWidth
            variant="bordered"
          >
            {idTypes.map((type) => (
              <SelectItem key={type.value} textValue={type.text}>
                {type.text}
              </SelectItem>
            ))}
          </Select>
        )}
      </div>

      {(activityType || eventName || customerId || deleted) && (
        <>
          <Spacer y={4} />
          <Divider />
          <Spacer y={4} />
        </>
      )}

      <div className="flex flex-row flex-wrap items-center gap-1">
        {request?.configuration?.activityType && (
          <Chip
            variant="bordered"
            startContent={<LuActivity />}
            endContent={(
              <LuX size={16} className="text-danger cursor-pointer" onClick={() => _handleActivityTypeChange("")} />
            )}
          >
            <span className="text-primary">
              {`Activity Type: ${_getActivityTypeName(request?.configuration?.activityType)}`}
            </span>
          </Chip>
        )}
        {request?.configuration?.eventName && (
          <Chip
            variant="bordered"
            startContent={<LuActivity />}
            endContent={(
              <LuX size={16} className="text-danger cursor-pointer" onClick={() => _handleEventNameChange("")} />
            )}
          >
            <span className="text-primary">
              {`Event Name: ${request?.configuration?.eventName}`}
            </span>
          </Chip>
        )}
        {request?.configuration?.customerId && (
          <Chip
            variant="bordered"
            startContent={<LuActivity />}
            endContent={(
              <LuX size={16} className="text-danger cursor-pointer" onClick={() => {
                _handleCustomerIdChange("");
                _handleIdTypeChange("id");
              }} />
            )}
          >
            <span className="text-primary">
              {`Customer ID (${_getIdTypeName(request?.configuration?.idType)}): ${request?.configuration?.customerId}`}
            </span>
          </Chip>
        )}
        {request?.configuration?.deleted && (
          <Chip
            variant="bordered"
            startContent={<LuActivity />}
            endContent={(
              <LuX size={16} className="text-danger cursor-pointer" onClick={() => _handleDeletedChange(false)} />
            )}
          >
            <span className="text-primary">
              Include deleted people
            </span>
          </Chip>
        )}
      </div>

      <Spacer y={4} />
      <Divider />
      <Spacer y={4} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center">
          <Checkbox
            isSelected={deleted}
            onChange={(e) => _handleDeletedChange(e.target.checked)}
            size="sm"
          >
            Include deleted people
          </Checkbox>
        </div>
        <Input
          label="Maximum number of results (0 = unlimited)"
          type="number"
          placeholder="Limit the number of records to return"
          value={limit}
          onChange={(e) => _handleLimitChange(parseInt(e.target.value, 10))}
          variant="bordered"
          endContent={hasLimitChanges && (
            <Button
              size="sm"
              color="success"
              variant="flat"
              onPress={_handleLimitSave}
            >
              Save
            </Button>
          )}
        />
      </div>
    </div>
  );
}

ActivitiesQuery.propTypes = {
  onUpdate: PropTypes.func.isRequired,
  request: PropTypes.object,
  connectionId: PropTypes.number.isRequired,
};

export default ActivitiesQuery;
