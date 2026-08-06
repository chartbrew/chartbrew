import React, { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@heroui/react";
import {
  LuChevronLeft,
  LuChevronRight,
  LuExternalLink,
} from "react-icons/lu";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";

import { cn } from "../../modules/utils";
import {
  getDiscoverSlides,
  getIconComponent,
  getTone,
} from "../UserDashboard/components/whatsNewPanelUtils";

function HomeDiscover() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const slides = useMemo(
    () => getDiscoverSlides({ navigate, dispatch }),
    [navigate, dispatch],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index > slides.length - 1) {
      setIndex(0);
    }
  }, [index, slides.length]);

  if (slides.length < 1) return null;

  const slide = slides[index] || slides[0];
  const tone = getTone(slide.colorScheme);
  const Icon = getIconComponent(slide.icon);
  const actionLabel = slide.ctaLabel || slide.action?.label || "Open";
  const isExternalAction = slide.action?.type === "external";
  const goTo = (nextIndex) => {
    const total = slides.length;
    setIndex(((nextIndex % total) + total) % total);
  };

  return (
    <aside className="max-h-96" aria-label="Discover more">
      <Card className="max-h-96 gap-0 rounded-3xl border border-divider shadow-none">
        <Card.Content className="flex max-h-96 flex-col gap-4 overflow-hidden p-5">
          <div className="flex flex-row items-start justify-between gap-3">
            {Icon ? (
              <div className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg border border-divider",
                tone.icon,
              )}>
                <Icon size={20} aria-hidden />
              </div>
            ) : null}
            {slide.timestampLabel ? (
              <span className="text-xs text-muted">{slide.timestampLabel}</span>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            {slide.eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {slide.eyebrow}
              </p>
            ) : null}
            <Card.Title className="text-lg font-semibold leading-tight">
              {slide.title}
            </Card.Title>
            <p className="text-sm leading-6 text-muted">
              {slide.body}
            </p>

            {slide.action ? (
              <Button
                className="mt-1 self-start"
                onPress={() => slide.action?.onPress?.()}
                size="sm"
                variant="tertiary"
              >
                {actionLabel}
                {isExternalAction
                  ? <LuExternalLink size={16} aria-hidden />
                  : <LuChevronRight size={16} aria-hidden />}
              </Button>
            ) : null}
          </div>

          {slides.length > 1 ? (
            <div className="flex shrink-0 flex-row items-center justify-between gap-3 pt-1">
              <div className="flex flex-row items-center gap-1.5" role="tablist" aria-label="Discover slides">
                {slides.map((item, slideIndex) => (
                  <button
                    aria-label={`Show ${item.title}`}
                    aria-selected={slideIndex === index}
                    className={cn(
                      "h-2 rounded-full transition-all",
                      slideIndex === index
                        ? "w-5 bg-foreground"
                        : "w-2 bg-foreground/30 hover:bg-foreground/50",
                    )}
                    key={item.id}
                    onClick={() => setIndex(slideIndex)}
                    role="tab"
                    type="button"
                  />
                ))}
              </div>

              <div className="flex flex-row items-center gap-2">
                <Button
                  aria-label="Previous tip"
                  className="rounded-full"
                  isIconOnly
                  onPress={() => goTo(index - 1)}
                  size="sm"
                  variant="outline"
                >
                  <LuChevronLeft size={16} aria-hidden />
                </Button>
                <Button
                  aria-label="Next tip"
                  className="rounded-full"
                  isIconOnly
                  onPress={() => goTo(index + 1)}
                  size="sm"
                  variant="outline"
                >
                  <LuChevronRight size={16} aria-hidden />
                </Button>
              </div>
            </div>
          ) : null}
        </Card.Content>
      </Card>
    </aside>
  );
}

export default HomeDiscover;
