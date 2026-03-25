import {
  Button,
  Card,
  Chip,
  Separator,
} from "@heroui/react";
import PropTypes from "prop-types";
import React from "react";
import { LuChevronRight, LuExternalLink, LuX } from "react-icons/lu";
import { useNavigate } from "react-router";
import { useDispatch } from "react-redux";

import { cn } from "../../../modules/utils";
import { toggleAiModal } from "../../../slices/ui";
import {
  getIconComponent,
  getTone,
} from "./whatsNewPanelUtils";

function getWhatsNewContent({ navigate, dispatch }) {
  return {
    groups: [
      {
        key: "features",
        title: "New features",
        items: [
          {
            id: "slack-ai-integration",
            type: "newFeature",
            title: "Ask Chartbrew from Slack",
            body: "Use Slack to ask Chartbrew questions and get instant insights.",
            // badge: "New",
            icon: "slack",
            colorScheme: "primary",
            ctaLabel: "Open integrations",
            timestampLabel: "Just added",
            action: {
              label: "Open integrations",
              onPress: () => navigate("/integrations"),
            },
          },
          {
            id: "ai-chart-builder",
            type: "newFeature",
            title: "AI chart builder",
            body: "Describe the chart you want, Chartbrew creates the first draft.",
            // badge: "New",
            icon: "brain",
            colorScheme: "primary",
            ctaLabel: "Open AI assistant",
            timestampLabel: "Just added",
            action: {
              label: "Open AI assistant",
              onPress: () => dispatch(toggleAiModal()),
            },
          },
        ],
      },
      // {
      //   key: "releaseHighlights",
      //   title: "Release highlights",
      //   items: [
      //   ],
      // },
      {
        key: "underusedCapabilities",
        title: "Underused capabilities",
        items: [
          {
            id: "scheduled-reports",
            type: "underusedCapability",
            title: "Scheduled reports",
            body: "Send chart snapshots automatically to your inbox.",
            icon: "calendar",
            colorScheme: "warning",
            ctaLabel: "Read tutorial",
            timestampLabel: "Often missed",
            action: {
              label: "Read tutorial",
              onPress: () => window.open("https://chartbrew.com/blog/automated-dashboard-snapshots-in-chartbrew", "_blank"),
              type: "external",
            },
          },
        ],
      },
    ],
    tip: {
      id: "tip-variables",
      type: "tip",
      variant: "tip",
      eyebrow: "Pro tip",
      title: "Turn one dashboard into many views",
      body: "Variables help you reuse the same charts across date ranges, filters, and segments.",
      icon: "sparkles",
      colorScheme: "tip",
      ctaLabel: "Open variables guide",
      action: {
        label: "Open variables guide",
        onPress: () => window.open("https://chartbrew.com/blog/how-to-use-variables-in-chartbrew", "_blank"),
        type: "external",
      },
    },
  };
}

function WhatsNewItemCard({ item, onAction }) {
  const tone = getTone(item.colorScheme);
  const Icon = getIconComponent(item.icon);
  const actionLabel = item.ctaLabel || item.action?.label || "Open";
  const isExternalAction = item.action?.type === "external";

  if (item.variant === "tip") {
    return (
      <Card
        className={cn("overflow-hidden rounded-lg shadow-none", tone.tipCard)}
      >
        <Card.Content className="gap-4 p-5">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className={cn("mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl", tone.icon)}>
                <Icon size={18} />
              </div>
            )}
            <div className="flex-1">
              {item.eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-400">
                  {item.eyebrow}
                </p>
              )}
              <h3 className="mt-1 text-lg font-semibold leading-tight text-foreground">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-foreground-600">
                {item.body}
              </p>
            </div>
          </div>
          {item.action && (
            <Button
              className={cn("font-medium", tone.tipButton)}
              endContent={isExternalAction ? <LuExternalLink size={16} /> : <LuChevronRight size={16} />}
              onPress={() => onAction(item.action)}
              color="primary"
              variant="flat"
            >
              {actionLabel}
            </Button>
          )}
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card
      className={cn("rounded-lg border-1 bg-content1 shadow-none", tone.card)}
    >
      <Card.Content className="gap-4 p-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", tone.icon)}>
              <Icon size={18} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {item.title}
              </h3>
              {item.badge && (
                <Chip size="sm" variant="flat" color={tone.badge}>
                  {item.badge}
                </Chip>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-foreground-600">
              {item.body}
            </p>
            {(item.timestampLabel || item.action) && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-foreground-400">
                  {item.timestampLabel}
                </span>
                {item.action && (
                  <Button
                    size="sm"
                    variant="light"
                    color={tone.badge}
                    endContent={isExternalAction ? <LuExternalLink size={14} /> : <LuChevronRight size={14} />}
                    onPress={() => onAction(item.action)}
                  >
                    {actionLabel}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

WhatsNewItemCard.propTypes = {
  item: PropTypes.shape({
    action: PropTypes.shape({
      label: PropTypes.string,
      onPress: PropTypes.func,
      type: PropTypes.oneOf(["external"]),
    }),
    badge: PropTypes.string,
    body: PropTypes.string.isRequired,
    colorScheme: PropTypes.string,
    ctaLabel: PropTypes.string,
    eyebrow: PropTypes.string,
    icon: PropTypes.string,
    timestampLabel: PropTypes.string,
    title: PropTypes.string.isRequired,
    variant: PropTypes.oneOf(["tip"]),
  }).isRequired,
  onAction: PropTypes.func.isRequired,
};

function WhatsNewPanel({ onCollapse }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { groups, tip } = getWhatsNewContent({ navigate, dispatch });

  const handleAction = (action) => {
    action?.onPress?.();
  };

  if (groups.length < 1 && !tip) {
    return null;
  }

  return (
    <aside className="sticky top-[88px]">
      <Card className="rounded-lg border-1 border-divider bg-content1 shadow-none">
        <Card.Header className="flex items-start justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Discover more
            </h2>
            <p className="mt-1 text-sm text-foreground-500">
              New features, tips, and shortcuts for Chartbrew.
            </p>
          </div>
          <Button isIconOnly size="sm" variant="light" onPress={onCollapse}>
            <LuX size={16} />
          </Button>
        </Card.Header>
        <Separator />
        <Card.Content className="flex flex-col gap-4 px-4 py-5">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <div className="flex flex-col gap-3">
                {group.items.map((item) => (
                  <WhatsNewItemCard
                    key={item.id}
                    item={item}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </section>
          ))}

          {tip && (
            <>
              <Separator />
              <section className="flex flex-col gap-3">
                <WhatsNewItemCard item={tip} onAction={handleAction} />
              </section>
            </>
          )}
        </Card.Content>
      </Card>
    </aside>
  );
}

WhatsNewPanel.propTypes = {
  onCollapse: PropTypes.func.isRequired,
};

export default WhatsNewPanel;
